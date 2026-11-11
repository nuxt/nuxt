import { extname, normalize } from 'pathe'
import { tryUseNuxt, useNuxt } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { klona } from 'klona'
import { parseAndWalk } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'

import { getLoader, parseModuleId } from '../core/utils/index.ts'
import { findSFCScriptBlocks, getStaticPropertyKey, unwrapStaticExpression } from '../core/utils/parse-utils.ts'
import { linkToAlias, logger, offsetToPosition } from '../utils.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'

/**
 * Whether serializable page meta is written into the route record.
 *
 * The macro transform and route augmentation both have to agree on this, and neither can
 * extract when page meta is not scanned at all: the route record does not override the macro
 * module in that case, so extracting would duplicate the values rather than replace them.
 */
export function shouldExtractSerializablePageMeta (nuxt = useNuxt()): boolean {
  return !!nuxt.options.experimental.scanPageMeta && !!nuxt.options.experimental.extractSerializablePageMeta
}

function extractScriptContent (sfc: string) {
  return findSFCScriptBlocks(sfc).filter(block => block.content).map(({ attrs, content, start }) => ({
    loader: /[tj]sx/.test(attrs) ? 'tsx' as const : 'ts' as const,
    code: content.trim(),
    // offsets within the trimmed script block are reported against the whole SFC
    offset: start + content.length - content.trimStart().length,
  }))
}

const PAGE_META_MACRO_NAMES = new Set(['definePageMeta', 'defineRouteRules'])
// Cheap pre-scan only, to skip parsing scripts that cannot contain a macro. The AST walk below
// is what actually identifies calls.
const HAS_PAGE_MACRO_RE = new RegExp(`\\b(?:${[...PAGE_META_MACRO_NAMES].join('|')})\\b`)
export const defaultExtractionKeys = ['name', 'path', 'props', 'alias', 'redirect', 'middleware'] as const
const EMPTY_DYNAMIC_META: ReadonlySet<string> = new Set<string>()

/**
 * Which `definePageMeta` keys could not be statically extracted and must come from the runtime
 * macro module, recorded per nuxt instance and keyed by page file.
 *
 * A page's dynamic keys are a pure function of its file, because extraction parses that file's
 * contents and nothing else, and `page.file` is the one field that survives the page being
 * rebuilt: modules in `pages:extend`/`pages:resolved` clone, merge and delete `page.meta` and
 * replace the page objects wholesale (route localization emits a shallow copy per locale), while a
 * page that loses its file loses its macro module too, which fails loudly instead of silently.
 *
 * Keyed by path with the latest extraction winning rather than by content, because
 * `normalizeRoutes` has no contents to hash and augmentation always re-runs for a changed file
 * before routes are generated, so a stale set cannot be observed. Scoped per instance because
 * `extraPageMetaExtractionKeys` can differ between two instances sharing an absolute path.
 */
const dynamicPageMetaCaches = new WeakMap<object, Map<string, ReadonlySet<string>>>()
// Used when pages are augmented outside of a nuxt instance, so that both sides agree on a cache.
const detachedDynamicPageMeta = new Map<string, ReadonlySet<string>>()

export function dynamicPageMetaCache (nuxt: Nuxt | null | undefined = tryUseNuxt()): Map<string, ReadonlySet<string>> {
  if (!nuxt) {
    return detachedDynamicPageMeta
  }
  let cache = dynamicPageMetaCaches.get(nuxt)
  if (!cache) {
    cache = new Map()
    dynamicPageMetaCaches.set(nuxt, cache)
  }
  return cache
}

/**
 * Keys of `page` that `definePageMeta` sets at runtime rather than at build time. A page without a
 * file has no macro module to defer to, so it never needs these and no fallback is required.
 */
export function getDynamicPageMeta (page: NuxtPage, cache = dynamicPageMetaCache()): ReadonlySet<string> {
  return (page.file ? cache.get(normalize(page.file)) : undefined) ?? EMPTY_DYNAMIC_META
}

function isPlainProperty (property: ESTree.ObjectPropertyKind): property is ESTree.ObjectProperty {
  return property.type === 'Property' && !property.computed && property.kind === 'init' && !property.method
}

function collectStatementCalls (body: Array<ESTree.Node>, into: Set<ESTree.Node>) {
  for (const statement of body) {
    if (statement.type !== 'ExpressionStatement') { continue }
    const expression = unwrapStaticExpression(statement.expression)
    if (expression?.type === 'CallExpression') {
      into.add(expression)
    }
  }
}

/**
 * The body of the `setup()` option of an Options API default export, if the module has one.
 */
function findOptionsApiSetupBody (program: ESTree.Program): Array<ESTree.Node> | undefined {
  for (const statement of program.body) {
    if (statement.type !== 'ExportDefaultDeclaration') { continue }

    let declaration = unwrapStaticExpression(statement.declaration as ESTree.Node)
    // `export default defineComponent({ ... })`
    if (declaration?.type === 'CallExpression') {
      declaration = unwrapStaticExpression(declaration.arguments[0])
    }
    if (declaration?.type !== 'ObjectExpression') { return }

    for (const property of declaration.properties) {
      if (property.type !== 'Property' || property.kind !== 'init' || getStaticPropertyKey(property) !== 'setup') { continue }
      const value = property.value
      if ((value.type === 'FunctionExpression' || value.type === 'ArrowFunctionExpression') && value.body?.type === 'BlockStatement') {
        return value.body.body
      }
    }
    return
  }
}

/**
 * The keys of `definePageMeta` whose values are read at build time, given the user's
 * `experimental.extraPageMetaExtractionKeys`.
 *
 * Both halves of the macro pipeline have to agree on this set: `getRouteMeta` reads these keys
 * into the route record, and `PageMetaPlugin` removes them from the macro module.
 */
export function resolvePageMetaExtractionKeys (extraKeys: Iterable<string> = []): Set<keyof NuxtPage> {
  return new Set<keyof NuxtPage>([...defaultExtractionKeys, ...extraKeys as Iterable<keyof NuxtPage>])
}

/**
 * How a single `definePageMeta` property reaches the route record.
 *
 * - `extract` - the value is statically known, so it is written into the route record and removed
 *   from the macro module.
 * - `dynamic` - an extracted key whose value needs evaluating, so that one route field falls back
 *   to the macro module.
 * - `reshape` - the macro transform rewrites the property into keys the route record cannot
 *   express (`layout: { name, props }` becomes `layout` plus `layoutProps`). A `value` means the
 *   reshaped keys are statically known, so the route record owns them; without one the macro
 *   module resolves it.
 * - `runtime` - the property is not extracted at all, so the whole meta object falls back to the
 *   macro module. A `key` is included when the property has a statically known key.
 */
export type PageMetaProperty =
  | { kind: 'extract', key: string, value: any }
  | { kind: 'dynamic', key: string }
  | { kind: 'reshape', key: string, node: ESTree.ObjectExpression, value?: { name: any, props?: any } }
  | { kind: 'runtime', key?: string }

export interface ClassifyPageMetaOptions {
  /**
   * Extract any JSON-serializable property, not just the keys in `extractionKeys`. Properties
   * whose values cannot be serialized still fall back to the macro module.
   */
  extractSerializable?: boolean
}

/**
 * Classify a property of a `definePageMeta` object literal.
 *
 * A property may only be removed from the macro module when it is also extracted into the route
 * record, and vice versa, or its value is lost. Both sides call this so that the two cannot
 * drift apart.
 */
export function classifyPageMetaProperty (property: ESTree.ObjectPropertyKind, extractionKeys: ReadonlySet<string>, options: ClassifyPageMetaOptions = {}): PageMetaProperty {
  // Spreads and computed keys cannot be resolved without evaluating the module.
  const key = getStaticPropertyKey(property)
  if (key === undefined) {
    return { kind: 'runtime' }
  }

  // Getters and methods have a known key but a runtime value.
  if (!isPlainProperty(property)) {
    return { kind: 'runtime', key }
  }

  const value = unwrapStaticExpression(property.value)
  if (key === 'layout' && value?.type === 'ObjectExpression') {
    // Only `{ name, props }` can be rewritten into `layout` + `layoutProps`. Any other shape
    // (spreads, computed keys, unknown keys) has no equivalent, so leave the object untouched
    // rather than silently dropping parts of it.
    const reshapable = value.properties.every(subProperty =>
      isPlainProperty(subProperty) && subProperty.key.type === 'Identifier' && (subProperty.key.name === 'name' || subProperty.key.name === 'props'),
    )
    if (!reshapable) {
      return { kind: 'runtime', key }
    }
    if (options.extractSerializable) {
      const serialized = isSerializable(value)
      // Without a `name` there is no `layout` key to write, and a route record cannot express
      // `layoutProps` on its own, so leave the whole object to the macro module.
      if (serialized.serializable && serialized.value && 'name' in serialized.value) {
        return { kind: 'reshape', key, node: value, value: serialized.value }
      }
    }
    return { kind: 'reshape', key, node: value }
  }

  const isExtractionKey = extractionKeys.has(key)
  if (!isExtractionKey && !options.extractSerializable) {
    return { kind: 'runtime', key }
  }

  const serialized = isSerializable(property.value)
  if (serialized.serializable) {
    return { kind: 'extract', key, value: serialized.value }
  }
  // An unlisted key has no route field of its own to fall back to, so the whole meta object has
  // to come from the macro module.
  return isExtractionKey ? { kind: 'dynamic', key } : { kind: 'runtime', key }
}

const pageContentsCache: Record<string, string> = {}
// Keyed by file path, then by extraction variant. Two nuxt instances in one process can extract
// the same absolute path with different `extraPageMetaExtractionKeys` or a different serializable
// mode, and get legitimately different results from identical contents, so the variant has to be
// part of the key while invalidation stays per file.
const extractCache = new Map<string, Map<string, Partial<Record<keyof NuxtPage, any>>>>()
const dynamicMetaCache = new Map<string, Map<string, ReadonlySet<string>>>()

function getExtractVariant (extraExtractionKeys: Set<string>, options: ClassifyPageMetaOptions) {
  return `${options.extractSerializable ? 'serializable' : 'raw'}\0${[...extraExtractionKeys].sort().join(',')}`
}

function cacheVariant<T> (cache: Map<string, Map<string, T>>, absolutePath: string) {
  let variants = cache.get(absolutePath)
  if (!variants) {
    variants = new Map()
    cache.set(absolutePath, variants)
  }
  return variants
}

/**
 * Keys a page file's `definePageMeta` call sets at runtime rather than at build time. Derived
 * purely from file contents, so it is cached alongside the extracted metadata for that file.
 */
export function getDynamicMetaKeys (absolutePath: string, extraExtractionKeys: Set<string> = new Set(), options: ClassifyPageMetaOptions = {}): ReadonlySet<string> {
  return dynamicMetaCache.get(absolutePath)?.get(getExtractVariant(extraExtractionKeys, options)) ?? EMPTY_DYNAMIC_META
}

/**
 * Whether build-time scanning can see a page file's `definePageMeta` call. A file in a format the
 * scanner cannot parse (e.g. `.md` compiled to a component by a build plugin) may still call the
 * macro once transformed, so all of its metadata has to be left to the runtime macro module.
 * Extensionless entries have no module to transform and so nothing to fall back to.
 */
export function isScannablePageFile (path: string) {
  const { pathname } = parseModuleId(path)
  return !!getLoader(pathname) || !extname(pathname)
}

/** Where the first `definePageMeta` call of a page sets `key`, as `file:line:column`. */
export function locatePageMetaKey (contents: string, absolutePath: string, key: string): string | undefined {
  const loader = getLoader(absolutePath)
  if (!loader) {
    return
  }
  const scriptBlocks = loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader, offset: 0 }]
  for (const script of scriptBlocks) {
    if (!script.code.includes('definePageMeta')) { continue }
    let call: ESTree.CallExpression | undefined
    parseAndWalk(script.code, absolutePath.replace(/\.\w+$/, '.' + script.loader), (node) => {
      if (!call && node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'definePageMeta') {
        call = node
      }
    })
    const argument = unwrapStaticExpression(call?.arguments[0])
    if (argument?.type !== 'ObjectExpression') { continue }
    const property = argument.properties.findLast(property => getStaticPropertyKey(property) === key)
    if (property) {
      const { line, column } = offsetToPosition(contents, script.offset + property.start)
      return `${absolutePath}:${line}:${column}`
    }
  }
}

export function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys: Set<string> = new Set(), options: ClassifyPageMetaOptions = {}): Partial<Record<keyof NuxtPage, any>> {
  const variant = getExtractVariant(extraExtractionKeys, options)

  if (pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    extractCache.delete(absolutePath)
    dynamicMetaCache.delete(absolutePath)
  }

  const cached = extractCache.get(absolutePath)?.get(variant)
  if (cached) {
    return klona(cached)
  }

  const extractionKeys = resolvePageMetaExtractionKeys(extraExtractionKeys)

  const loader = getLoader(absolutePath)
  if (!loader) {
    if (!isScannablePageFile(absolutePath)) {
      cacheVariant(dynamicMetaCache, absolutePath).set(variant, new Set<string>([...extractionKeys, 'meta']))
    }
    cacheVariant(extractCache, absolutePath).set(variant, {})
    return {}
  }

  const scriptBlocks = loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader, offset: 0 }]

  const extractedData: Partial<Record<keyof NuxtPage, any>> = {}
  const fileAt = (offset: number) => linkToAlias(absolutePath, undefined, offsetToPosition(contents, offset))

  // Widened for lookups by a property name that may not be a route field at all.
  const routeFieldKeys: ReadonlySet<string> = extractionKeys
  const dynamicProperties = new Set<keyof NuxtPage>()

  for (const script of scriptBlocks) {
    if (!HAS_PAGE_MACRO_RE.test(script.code)) { continue }

    const macroCalls: Array<{ fnName: string, node: ESTree.CallExpression }> = []

    const { program } = parseAndWalk(script.code, absolutePath.replace(/\.\w+$/, '.' + script.loader), (node) => {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && PAGE_META_MACRO_NAMES.has(node.callee.name)) {
        macroCalls.push({ fnName: node.callee.name, node })
      }
    })

    const topLevelCalls = new Set<ESTree.Node>()
    collectStatementCalls(program.body, topLevelCalls)
    // A page written without `<script setup>` has no other place to call the macros than the top
    // level of its `setup()`, so a call there is as unconditional as a top-level one.
    const setupBody = findOptionsApiSetupBody(program)
    if (setupBody) {
      collectStatementCalls(setupBody, topLevelCalls)
    }

    const extractedMacros = new Set<string>()

    for (const { fnName, node } of macroCalls) {
      // The macros are extracted whatever position they appear in, so a call that is not a
      // top-level statement (nested in a condition, or used as an expression) does not mean what
      // it looks like it means.
      if (!topLevelCalls.has(node)) {
        pageDiagnostics.NUXT_B4007({ fnName, file: fileAt(script.offset + node.start) })
      }

      // The macro transform reads the first call per macro (and errors on a second
      // `definePageMeta`), so read the same one.
      if (extractedMacros.has(fnName)) { continue }
      extractedMacros.add(fnName)

      const argument = unwrapStaticExpression(node.arguments[0])

      if (argument?.type !== 'ObjectExpression') {
        pageDiagnostics.NUXT_B4005({ fnName, file: fileAt(script.offset + node.start), receivedType: String(argument?.type) })
        if (fnName === 'definePageMeta') {
          // The macro module resolves the object at runtime, so the route record cannot own it.
          dynamicProperties.add('meta')
        }
        continue
      }

      if (fnName === 'defineRouteRules') {
        const { value, serializable } = isSerializable(argument)
        if (!serializable) {
          pageDiagnostics.NUXT_B4006({ fnName, file: fileAt(script.offset + node.start) })
          continue
        }

        extractedData.rules = value
        continue
      }

      const classified = new Map<string, Extract<PageMetaProperty, { kind: 'extract' | 'dynamic' | 'reshape' }>>()
      let hasRuntimeProperty = false

      for (const property of argument.properties) {
        const classification = classifyPageMetaProperty(property, extractionKeys, options)
        if (classification.kind === 'extract' || classification.kind === 'dynamic' || (classification.kind === 'reshape' && classification.value)) {
          // A duplicate key keeps its last occurrence, mirroring object-literal evaluation.
          classified.set(classification.key, classification)
          continue
        }

        // A later runtime value for a previously extracted key must not keep the extracted
        // value, which would override the macro module's runtime value in the route record.
        const key = classification.key
        if (key !== undefined) {
          if (classified.has(key)) {
            if (routeFieldKeys.has(key)) {
              classified.set(key, { kind: 'dynamic', key })
            } else {
              classified.delete(key)
            }
          }
        } else {
          // A spread or computed key can override any earlier key, so earlier classifications
          // cannot be kept.
          for (const classifiedKey of classified.keys()) {
            if (routeFieldKeys.has(classifiedKey)) {
              classified.set(classifiedKey, { kind: 'dynamic', key: classifiedKey })
            } else {
              classified.delete(classifiedKey)
            }
          }
        }
        hasRuntimeProperty = true
      }

      // Iterating the key set rather than the properties keeps the emitted order of `meta` keys
      // independent of the order they were written in.
      for (const key of extractionKeys) {
        const classification = classified.get(key)
        if (!classification || classification.kind === 'reshape') { continue }

        if (classification.kind === 'dynamic') {
          logger.debug(`Skipping extraction of \`${key}\` metadata as it is not JSON-serializable (reading \`${fileAt(script.offset + node.start)}\`).`)
          dynamicProperties.add(extraExtractionKeys.has(key) ? 'meta' : key)
          continue
        }

        if (extraExtractionKeys.has(key)) {
          extractedData.meta ??= {}
          extractedData.meta[key] = classification.value
        } else {
          extractedData[key] = classification.value
        }
      }

      // Keys with no route field of their own keep the order they were written in.
      for (const [key, classification] of classified) {
        if (classification.kind === 'reshape') {
          extractedData.meta ??= {}
          extractedData.meta.layout = classification.value!.name
          if (classification.value!.props !== undefined) {
            extractedData.meta.layoutProps = classification.value!.props
          }
          continue
        }
        if (routeFieldKeys.has(key) || classification.kind !== 'extract') { continue }
        extractedData.meta ??= {}
        extractedData.meta[key] = classification.value
      }

      if (hasRuntimeProperty) {
        dynamicProperties.add('meta')
      }
    }
  }

  if (dynamicProperties.size) {
    cacheVariant(dynamicMetaCache, absolutePath).set(variant, dynamicProperties)
  }

  cacheVariant(extractCache, absolutePath).set(variant, extractedData)
  return klona(extractedData)
}

export function isSerializable (node: ESTree.Node): { value?: any, serializable: boolean } {
  node = unwrapStaticExpression(node) || node

  if (node.type === 'Literal') {
    if (typeof node.value === 'string' || typeof node.value === 'number' || typeof node.value === 'boolean' || node.value === null) {
      return { value: node.value, serializable: true }
    }
    return { serializable: false }
  }

  if (node.type === 'UnaryExpression' && (node.operator === '-' || node.operator === '+')) {
    const arg = node.argument
    if (arg.type === 'Literal' && typeof arg.value === 'number') {
      return { value: node.operator === '-' ? -arg.value : arg.value, serializable: true }
    }
    return { serializable: false }
  }

  if (node.type === 'ArrayExpression') {
    const values: any[] = []
    for (const element of node.elements) {
      // `null` element is a sparse-array hole.
      if (!element || element.type === 'SpreadElement') {
        return { serializable: false }
      }
      const { serializable, value } = isSerializable(element)
      if (!serializable) {
        return { serializable: false }
      }
      values.push(value)
    }
    return { value: values, serializable: true }
  }

  if (node.type === 'ObjectExpression') {
    const value: Record<string, any> = {}
    for (const property of node.properties) {
      if (!isPlainProperty(property)) {
        return { serializable: false }
      }
      const key = getStaticPropertyKey(property)
      if (key === undefined) {
        return { serializable: false }
      }
      const { serializable, value: propertyValue } = isSerializable(property.value)
      if (!serializable) {
        return { serializable: false }
      }
      Object.defineProperty(value, key, { value: propertyValue, enumerable: true, writable: true, configurable: true })
    }
    return { value, serializable: true }
  }

  return { serializable: false }
}
