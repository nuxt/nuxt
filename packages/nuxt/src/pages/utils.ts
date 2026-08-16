import fs from 'node:fs'

import { normalize, relative } from 'pathe'
import { joinURL } from 'ufo'
import { getLayerDirectories, resolveFiles, resolvePath, useNuxt } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { genArrayFromRaw, genDynamicImport, genImport, genSafeVariableName } from 'knitwork'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'
import { defu } from 'defu'
import { klona } from 'klona'
import { parseAndWalk } from 'oxc-walker'
import type { ESTree } from 'rolldown/utils'
import { addFile, buildTree, compileParsePath, removeFile, toVueRouter4 } from 'unrouting'
import type { BuildTreeOptions, InputFile, RouteTree, VueRouterEmitOptions } from 'unrouting'

import { getLoader } from '../core/utils/index.ts'
import { linkToAlias, logger, offsetToPosition, toArray } from '../utils.ts'
import type { NuxtPage } from 'nuxt/schema'

// ---------------------------------------------------------------------------
// PagesContext — persistent route tree for incremental dev-mode updates
// ---------------------------------------------------------------------------

export interface PagesContext {
  /** Emit NuxtPage[] from the current tree state. */
  emit: () => NuxtPage[]
  /** Add a file to the tree (incremental). */
  addFile: (filePath: string, priority?: number) => void
  /** Remove a file from the tree. Returns `true` if the file was found and removed. */
  removeFile: (filePath: string) => boolean
  /** Full rebuild — replace tree contents from a fresh file list. */
  rebuild: (files: InputFile[]) => void
  /** Set of absolute file paths currently tracked in the tree. */
  trackedFiles: Set<string>
}

export interface PagesContextOptions {
  roots?: string[]
  shouldUseServerComponents?: boolean
}

export function createPagesContext (options: PagesContextOptions = {}): PagesContext {
  const modes = options.shouldUseServerComponents ? ['server', 'client'] : ['client']
  const treeOptions: BuildTreeOptions = {
    roots: options.roots,
    modes,
    warn: message => pageDiagnostics.NUXT_B4011({ message }),
  }
  const emitOptions: VueRouterEmitOptions = {
    onDuplicateRouteName: (_name, file, existingFile) => {
      pageDiagnostics.NUXT_B4004({ file: linkToAlias(file), existingFile: linkToAlias(existingFile) })
    },
    attrs: { mode: modes },
  }

  const compiledParse = compileParsePath(treeOptions)

  let tree: RouteTree = buildTree([], treeOptions)
  const trackedFiles = new Set<string>()

  return {
    emit () {
      return toVueRouter4(tree, emitOptions)
    },
    addFile (filePath: string, priority = 0) {
      addFile(tree, { path: filePath, priority }, compiledParse)
      trackedFiles.add(filePath)
    },
    removeFile (filePath: string) {
      const removed = removeFile(tree, filePath)
      if (removed) {
        trackedFiles.delete(filePath)
      }
      return removed
    },
    rebuild (files: InputFile[]) {
      tree = buildTree(files, treeOptions)
      trackedFiles.clear()
      for (const f of files) {
        trackedFiles.add(f.path)
      }
    },
    trackedFiles,
  }
}

// ---------------------------------------------------------------------------
// resolvePagesRoutes — full glob + build (initial load & fallback)
// ---------------------------------------------------------------------------

export async function resolvePagesRoutes (pattern: string | string[], nuxt = useNuxt(), ctx?: PagesContext, originalPagePaths?: WeakMap<NuxtPage, string>): Promise<NuxtPage[]> {
  const pagesDirs = getLayerDirectories(nuxt).map(d => d.appPages)

  const inputFiles: InputFile[] = []
  for (let priority = 0; priority < pagesDirs.length; priority++) {
    const dir = pagesDirs[priority]!
    const files = await resolveFiles(dir, pattern)
    for (const file of files) {
      inputFiles.push({ path: file, priority })
    }
  }

  let pages: NuxtPage[]
  if (ctx) {
    ctx.rebuild(inputFiles)
    pages = ctx.emit()
  } else {
    // One-shot for production / no-context case
    const oneShot = createPagesContext({ roots: pagesDirs, shouldUseServerComponents: !!nuxt.options.experimental.componentIslands })
    oneShot.rebuild(inputFiles)
    pages = oneShot.emit()
  }

  return augmentAndResolve(pages, ctx?.trackedFiles ?? new Set(inputFiles.map(f => f.path)), nuxt, originalPagePaths)
}

// ---------------------------------------------------------------------------
// augmentAndResolve — downstream pipeline (augmentation + hooks)
// ---------------------------------------------------------------------------

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

export async function augmentAndResolve (pages: NuxtPage[], trackedFiles: Set<string>, nuxt = useNuxt(), originalPagePaths?: WeakMap<NuxtPage, string>): Promise<NuxtPage[]> {
  const shouldAugment = nuxt.options.experimental.scanPageMeta || nuxt.options.experimental.typedPages

  if (shouldAugment === false) {
    await nuxt.callHook('pages:extend', pages)
    return pages
  }

  const extraPageMetaExtractionKeys = nuxt.options?.experimental?.extraPageMetaExtractionKeys || []

  const augmentCtx = {
    extraExtractionKeys: new Set([
      'middleware',
      ...extraPageMetaExtractionKeys,
    ]),
    extractSerializable: shouldExtractSerializablePageMeta(nuxt),
    fullyResolvedPaths: trackedFiles,
    originalPagePaths,
  }
  if (shouldAugment === 'after-resolve') {
    await nuxt.callHook('pages:extend', pages)
    await augmentPages(pages, nuxt.vfs, augmentCtx)
  } else {
    const augmentedPages = await augmentPages(pages, nuxt.vfs, augmentCtx)
    await nuxt.callHook('pages:extend', pages)
    await augmentPages(pages, nuxt.vfs, { pagesToSkip: augmentedPages, ...augmentCtx })
    augmentedPages?.clear()
  }

  await nuxt.callHook('pages:resolved', pages)

  return pages
}

interface AugmentPagesContext {
  fullyResolvedPaths?: Set<string>
  pagesToSkip?: Set<string>
  augmentedPages?: Set<string>
  extraExtractionKeys?: Set<string>
  extractSerializable?: boolean
  originalPagePaths?: WeakMap<NuxtPage, string>
}

export async function augmentPages (routes: NuxtPage[], vfs: Record<string, string>, ctx: AugmentPagesContext = {}) {
  ctx.augmentedPages ??= new Set()
  for (const route of routes) {
    if (route.file && !ctx.pagesToSkip?.has(route.file)) {
      const fileContent = vfs[route.file] ?? fs.readFileSync(ctx.fullyResolvedPaths?.has(route.file) ? route.file : await resolvePath(route.file), 'utf-8')
      const routeMeta = getRouteMeta(fileContent, route.file, ctx.extraExtractionKeys, { extractSerializable: ctx.extractSerializable })
      if (route.meta) {
        const dynamic = [...getDynamicMeta(routeMeta.meta), ...getDynamicMeta(route.meta)]
        routeMeta.meta = defu({}, routeMeta.meta, route.meta)
        addDynamicMeta(routeMeta.meta, dynamic)
      }
      if (route.rules) {
        routeMeta.rules = defu({}, routeMeta.rules, route.rules)
      }

      // Only the first route per file takes the file's `name`/`path`; a `pages:extend` route
      // reusing that file keeps its own, else the duplicate route name drops the original (#27358).
      if (ctx.augmentedPages.has(route.file)) {
        delete routeMeta.name
        delete routeMeta.path
      }

      // Store original paths when they are overridden.
      if (routeMeta.path !== undefined && routeMeta.path !== route.path) {
        ctx.originalPagePaths?.set(route, route.path)
      }

      Object.assign(route, routeMeta)
      ctx.augmentedPages.add(route.file)
    }

    if (route.children && route.children.length > 0) {
      await augmentPages(route.children, vfs, ctx)
    }
  }
  return ctx.augmentedPages
}

const SFC_SCRIPT_RE = /<script(?=\s|>)(?<attrs>[^>]*)>(?<content>[\s\S]*?)<\/script\s*>/dgi
function extractScriptContent (sfc: string) {
  const contents: Array<{ loader: 'tsx' | 'ts', code: string, offset: number }> = []
  for (const match of sfc.matchAll(SFC_SCRIPT_RE)) {
    const content = match?.groups?.content
    if (content) {
      const [contentStart] = match.indices!.groups!.content!
      contents.push({
        loader: match.groups!.attrs && /[tj]sx/.test(match.groups!.attrs) ? 'tsx' : 'ts',
        code: content.trim(),
        // offsets within the trimmed script block are reported against the whole SFC
        offset: contentStart + content.length - content.trimStart().length,
      })
    }
  }

  return contents
}

const PAGE_META_MACRO_NAMES = new Set(['definePageMeta', 'defineRouteRules'])
// Cheap pre-scan only, to skip parsing scripts that cannot contain a macro. The AST walk below
// is what actually identifies calls.
const HAS_PAGE_MACRO_RE = new RegExp(`\\b(?:${[...PAGE_META_MACRO_NAMES].join('|')})\\b`)
export const defaultExtractionKeys = ['name', 'path', 'props', 'alias', 'redirect', 'middleware'] as const
/**
 * Marks which `definePageMeta` keys could not be statically extracted and must come from the
 * runtime macro module. A symbol keeps it out of `JSON.stringify`/`Object.keys` snapshots taken by
 * modules that observe `page.meta`, at the cost of being dropped by key-enumerating helpers
 * (`defu`, `klona`), so it is re-attached explicitly wherever meta is merged or cloned.
 */
const DYNAMIC_META_KEY = Symbol.for('nuxt:dynamic-page-meta')

function getDynamicMeta (meta: Record<PropertyKey, any> | undefined): Set<string> {
  const dynamic = meta?.[DYNAMIC_META_KEY] as Set<string> | undefined
  return dynamic ?? new Set<string>()
}

function addDynamicMeta (meta: Record<PropertyKey, any> | undefined, keys: Iterable<string>) {
  const dynamic = new Set(keys)
  if (meta && dynamic.size) {
    meta[DYNAMIC_META_KEY] = dynamic
  }
}

type StaticExpressionWrapper = ESTree.Node & { expression: ESTree.Node }

const STATIC_EXPRESSION_WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
])

function unwrapStaticExpression (node: ESTree.Node | undefined): ESTree.Node | undefined {
  let current = node
  while (current && STATIC_EXPRESSION_WRAPPERS.has(current.type)) {
    current = (current as StaticExpressionWrapper).expression
  }
  return current
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
 *   macro module.
 */
export type PageMetaProperty =
  | { kind: 'extract', key: string, value: any }
  | { kind: 'dynamic', key: string }
  | { kind: 'reshape', key: string, node: ESTree.ObjectExpression, value?: { name: any, props?: any } }
  | { kind: 'runtime' }

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
  // Spreads, computed keys, getters and methods cannot be resolved without evaluating the module.
  if (property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method) {
    return { kind: 'runtime' }
  }

  let key: string
  if (property.key.type === 'Identifier') {
    key = property.key.name
  } else if (property.key.type === 'Literal' && (typeof property.key.value === 'string' || typeof property.key.value === 'number')) {
    key = String(property.key.value)
  } else {
    return { kind: 'runtime' }
  }

  const value = unwrapStaticExpression(property.value)
  if (key === 'layout' && value?.type === 'ObjectExpression') {
    // Only `{ name, props }` can be rewritten into `layout` + `layoutProps`. Any other shape
    // (spreads, computed keys, unknown keys) has no equivalent, so leave the object untouched
    // rather than silently dropping parts of it.
    const reshapable = value.properties.every(subProperty =>
      subProperty.type === 'Property' && !subProperty.computed && subProperty.kind === 'init' && !subProperty.method
      && subProperty.key.type === 'Identifier' && (subProperty.key.name === 'name' || subProperty.key.name === 'props'),
    )
    if (!reshapable) {
      return { kind: 'runtime' }
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
    return { kind: 'runtime' }
  }

  const serialized = isSerializable(property.value)
  if (serialized.serializable) {
    return { kind: 'extract', key, value: serialized.value }
  }
  // An unlisted key has no route field of its own to fall back to, so the whole meta object has
  // to come from the macro module.
  return isExtractionKey ? { kind: 'dynamic', key } : { kind: 'runtime' }
}

const SERIALIZABLE_CACHE_SUFFIX = '\0serializable'
const pageContentsCache: Record<string, string> = {}
const extractCache: Record<string, Partial<Record<keyof NuxtPage, any>>> = {}
export function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys: Set<string> = new Set(), options: ClassifyPageMetaOptions = {}): Partial<Record<keyof NuxtPage, any>> {
  // The extracted metadata differs between the two extraction modes, but the file contents do not.
  const cacheKey = options.extractSerializable ? absolutePath + SERIALIZABLE_CACHE_SUFFIX : absolutePath

  // set/update pageContentsCache, invalidate extractCache on cache mismatch
  if (!(absolutePath in pageContentsCache) || pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    delete extractCache[absolutePath]
    delete extractCache[absolutePath + SERIALIZABLE_CACHE_SUFFIX]
  }

  if (cacheKey in extractCache && extractCache[cacheKey]) {
    return cloneExtractedData(extractCache[cacheKey])
  }

  const loader = getLoader(absolutePath)
  const scriptBlocks = !loader ? null : loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader, offset: 0 }]
  if (!scriptBlocks) {
    extractCache[cacheKey] = {}
    return {}
  }

  const extractedData: Partial<Record<keyof NuxtPage, any>> = {}
  const fileAt = (offset: number) => linkToAlias(absolutePath, undefined, offsetToPosition(contents, offset))

  const extractionKeys = resolvePageMetaExtractionKeys(extraExtractionKeys)
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
    for (const statement of program.body) {
      if (statement.type !== 'ExpressionStatement') { continue }
      const expression = unwrapStaticExpression(statement.expression)
      if (expression?.type === 'CallExpression') {
        topLevelCalls.add(expression)
      }
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
    extractedData.meta ??= {}
    addDynamicMeta(extractedData.meta, dynamicProperties)
  }

  extractCache[cacheKey] = extractedData
  return cloneExtractedData(extractedData)
}

function cloneExtractedData (data: Partial<Record<keyof NuxtPage, any>>) {
  const cloned = klona(data)
  addDynamicMeta(cloned.meta, getDynamicMeta(data.meta))
  return cloned
}

function serializeRouteValue (value: any, skipSerialisation = false) {
  if (skipSerialisation || value === undefined) { return undefined }
  return JSON.stringify(value)
}

type NormalizedRoute = Partial<Record<Exclude<keyof NuxtPage, 'file'>, string>> & { component?: string }
type NormalizedRouteKeys = (keyof NormalizedRoute)[]
interface NormalizeRoutesOptions {
  overrideMeta?: boolean
  /** Pages whose component can only render in one environment, keyed by the stub to use elsewhere. */
  restrictedPages?: ReadonlyMap<NuxtPage, keyof typeof PAGE_STUBS>
  serverComponentRuntime: string
  clientComponentRuntime: string
}

// A page that can only render in one environment is imported there and stubbed
// in the other, dropping its component from the bundle it can never be used in.
const PAGE_STUBS = {
  // Navigation to a `noScripts` route is a document load (see the guard in
  // `runtime/plugins/router.ts`); the stub only recovers the right document if
  // the route is somehow reached anyway.
  noScripts: {
    env: 'server',
    name: '_noScriptsPageStub',
    declaration: '\nconst _noScriptsPageStub = { mounted: () => window.location.reload(), render: () => null };',
  },
  // The server only ever emits the SPA shell for an `ssr: false` route.
  spaOnly: {
    env: 'client',
    name: '_spaOnlyPageStub',
    declaration: '\nconst _spaOnlyPageStub = { render: () => null };',
  },
} as const

function normalizeComponent (page: NuxtPage, pageImport: string, routeName: string | undefined, islandKey: string | undefined): string {
  if (page.mode === 'server') {
    return `() => createIslandPage(${routeName}, import.meta.server ? ${islandKey} : undefined)`
  }
  if (page.mode === 'client') {
    return `() => createClientPage(${onlyOnClient(pageImport)})`
  }
  return pageImport
}

// Dropping the loader on the server keeps the page chunk out of that bundle;
// `createClientPage` falls back to a placeholder without it.
function onlyOnClient (pageImport: string) {
  return `import.meta.client ? ${pageImport} : undefined`
}

function normalizeComponentWithName (page: NuxtPage, isSyncImport: boolean | undefined, pageImportName: string, pageImport: string, routeName: string | undefined, metaRouteName: string, islandKey: string | undefined): string {
  if (isSyncImport) {
    return `Object.assign(${pageImportName}, { __name: ${metaRouteName} })`
  }
  // Server components already receive the name via createIslandPage(name)
  if (page.mode === 'server') {
    return `() => createIslandPage(${routeName}, import.meta.server ? ${islandKey} : undefined)`
  }
  // Client components return a processed component (not a module with .default)
  if (page.mode === 'client') {
    return `() => createClientPage(${onlyOnClient(pageImport)}).then((c) => Object.assign(c, { __name: ${metaRouteName} }))`
  }
  return `${pageImport}.then((m) => Object.assign(m.default, { __name: ${metaRouteName} }))`
}

export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set(), options: NormalizeRoutesOptions): { imports: Set<string>, routes: string } {
  const nuxt = useNuxt()
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const markedDynamic = getDynamicMeta(page.meta)
      const metaFiltered: Record<string, any> = {}
      let skipMeta = true
      for (const key in page.meta || {}) {
        if (page.meta![key] !== undefined) {
          skipMeta = false
          metaFiltered[key] = page.meta![key]
        }
      }

      const skipAlias = toArray(page.alias).every(val => !val)

      const route: NormalizedRoute = {
        path: serializeRouteValue(page.path),
        props: serializeRouteValue(page.props),
        name: serializeRouteValue(page.name),
        meta: serializeRouteValue(metaFiltered, skipMeta),
        alias: serializeRouteValue(toArray(page.alias), skipAlias),
        redirect: serializeRouteValue(page.redirect),
      }

      for (const key of [...defaultExtractionKeys, 'meta'] satisfies NormalizedRouteKeys) {
        if (route[key] === undefined) {
          delete route[key]
        }
      }

      if (page.children?.length) {
        route.children = normalizeRoutes(page.children, metaImports, options).routes
      }

      // Without a file, we can't use `definePageMeta` to extract route-level meta from the file
      if (!page.file) {
        return route
      }

      const file = normalize(page.file)
      const pageImportName = genSafeVariableName(filename(file) + hash(file).replace(/-/g, '_'))
      const metaImportName = pageImportName + 'Meta'
      const metaImport = genImport(`${file}?macro=true`, [{ name: 'default', as: metaImportName }])

      const restriction = options.restrictedPages?.get(page)
      const stub = restriction ? PAGE_STUBS[restriction] : undefined
      if (stub) {
        metaImports.add(stub.declaration)
      }
      const restrictToEnvironment = (loader: string) => stub
        ? `import.meta.${stub.env} ? ${loader} : () => Promise.resolve(${stub.name})`
        : loader

      // A statically imported page would be linked into the bundle it is being
      // dropped from even when its component is never referenced there, so
      // environment-restricted pages fall back to a droppable dynamic import
      if (page._sync && !stub) {
        metaImports.add(genImport(file, [{ name: 'default', as: pageImportName }]))
      }

      const isSyncImport = page._sync && page.mode !== 'client' && !stub
      const pageImport = isSyncImport ? pageImportName : genDynamicImport(file)
      // Mirror whatever the route's own `name` resolves to below, so that a name extracted at
      // build time does not pull in the macro module purely to set `__name`. That import is the
      // only static import in the route table, so keeping it costs one browser request per page
      // before the router can be created.
      const metaRouteName = options?.overrideMeta && !markedDynamic.has('name')
        ? route.name ?? `${metaImportName}?.name`
        : `${metaImportName}?.name ?? ${route.name}`

      // we use this to validate that a server page is rendering the correct url
      const islandKey = page.mode === 'server' && page.file
        ? JSON.stringify(hash(relative(nuxt.options.rootDir, page.file)))
        : undefined

      const component = restrictToEnvironment(nuxt.options.experimental.normalizePageNames
        ? normalizeComponentWithName(page, isSyncImport, pageImportName, pageImport, route.name, metaRouteName, islandKey)
        : normalizeComponent(page, pageImport, route.name, islandKey))

      // Named views from the `name@view.vue` filename convention. The scanner
      // emits `components: { default: <file>, <view>: <file> }`.
      // https://router.vuejs.org/guide/essentials/named-views.html
      let componentsObject: string | undefined
      if (page.components) {
        const viewEntries: string[] = []
        for (const viewName in page.components) {
          if (viewName === 'default') { continue }
          const viewFile = normalize(page.components[viewName]!)
          viewEntries.push(`${JSON.stringify(viewName)}: ${restrictToEnvironment(genDynamicImport(viewFile))}`)
        }
        if (viewEntries.length > 0) {
          componentsObject = `{ default: ${component}, ${viewEntries.join(', ')} }`
        }
      }

      const metaRoute: NormalizedRoute = {
        name: metaRouteName,
        path: `${metaImportName}?.path ?? ${route.path}`,
        props: `${metaImportName}?.props ?? ${route.props ?? false}`,
        meta: `${metaImportName} || {}`,
        alias: `${metaImportName}?.alias || []`,
        redirect: `${metaImportName}?.redirect`,
        component,
      }
      if (componentsObject) {
        metaRoute.components = componentsObject
      }

      if (page.mode === 'server') {
        metaImports.add(`
let _createIslandPage
async function createIslandPage (name, islandKey) {
  _createIslandPage ||= await import(${JSON.stringify(options?.serverComponentRuntime)}).then(r => r.createIslandPage)
  return _createIslandPage(name, islandKey)
};`)
      } else if (page.mode === 'client') {
        metaImports.add(`
let _createClientPage
async function createClientPage(loader) {
  _createClientPage ||= await import(${JSON.stringify(options?.clientComponentRuntime)}).then(r => r.createClientPage)
  return _createClientPage(loader);
}`)
      }

      if (route.children) {
        metaRoute.children = route.children
      }

      if (route.meta) {
        metaRoute.meta = `{ ...(${metaImportName} || {}), ...${route.meta} }`
      }

      if (options?.overrideMeta) {
        // skip and retain fallback if marked dynamic
        // set to extracted value or fallback if none extracted
        for (const key of ['name', 'path'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }
          metaRoute[key] = route[key] ?? `${metaImportName}?.${key}`
        }

        // set to extracted value or delete if none extracted
        for (const key of ['meta', 'alias', 'redirect', 'props'] satisfies NormalizedRouteKeys) {
          if (markedDynamic.has(key)) { continue }

          if (route[key] == null) {
            delete metaRoute[key]
            continue
          }

          metaRoute[key] = route[key]
        }
      } else {
        if (route.alias != null) {
          metaRoute.alias = `${route.alias}.concat(${metaImportName}?.alias || [])`
        }

        if (route.redirect != null) {
          metaRoute.redirect = route.redirect
        }
      }

      // Nested routes reference their own macro modules, so they are excluded here.
      const { children, ...ownFields } = metaRoute
      if (Object.values(ownFields).some(field => field?.includes(metaImportName))) {
        metaImports.add(metaImport)
      }

      return metaRoute
    })),
  }
}

export function resolveRoutePaths (page: NuxtPage, parent = '/'): string[] {
  return [
    joinURL(parent, page.path),
    ...page.children?.flatMap(child => resolveRoutePaths(child, joinURL(parent, page.path))) || [],
  ]
}

// `:id()` matches identically to `:id` in vue-router (an empty regex falls back to the
// default matcher), so collapse an empty param regex before comparing segments.
const EMPTY_PARAM_REGEXP_RE = /:(\w+)\(\)([+*?]?)/g
function canonicalizeParams (path: string): string {
  return path.replace(EMPTY_PARAM_REGEXP_RE, ':$1$2')
}
/**
 * Strip the leading segments an absolute child path shares with its parent's `fullPath`.
 * Inserting only the remainder avoids re-declaring the parent's params on the child node.
 * The remainder only determines the node's own params, as the absolute child path is
 * re-applied as a path override afterwards and becomes the route's `fullPath`.
 *
 * Returns `undefined` when the child path does not extend the parent's full path, as there
 * is then no remainder that declares the child's own params and nothing else.
 */
export function relativizeToParent (parentFullPath: string, childPath: string): string | undefined {
  if (!childPath.startsWith('/')) {
    return childPath
  }
  const parentSegments = canonicalizeParams(parentFullPath).replace(/\/$/, '').split('/')
  const childSegments = childPath.split('/')
  for (let index = 0; index < parentSegments.length; index++) {
    if (canonicalizeParams(childSegments[index] ?? '') !== parentSegments[index]) {
      return
    }
  }
  return childSegments.slice(parentSegments.length).join('/')
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
      if (property.type !== 'Property' || property.computed || property.kind !== 'init' || property.method) {
        return { serializable: false }
      }
      let key: string
      if (property.key.type === 'Identifier') {
        key = property.key.name
      } else if (property.key.type === 'Literal' && (typeof property.key.value === 'string' || typeof property.key.value === 'number')) {
        key = String(property.key.value)
      } else {
        return { serializable: false }
      }
      const { serializable, value: propertyValue } = isSerializable(property.value)
      if (!serializable) {
        return { serializable: false }
      }
      value[key] = propertyValue
    }
    return { value, serializable: true }
  }

  return { serializable: false }
}

export function toRou3Patterns (pages: NuxtPage[], prefix = '/'): string[] {
  const routes: string[] = []
  for (const page of pages) {
    // convert to rou3-compatible path (https://github.com/h3js/rou3)
    const path = page.path
      // remove all regex patterns
      .replace(/\([^)]*\)/g, '')
      // catchalls: `:name([^/]*)*` or `:catchall(.*)*`
      .replace(/:(\w+)\*.*/g, (_, name) => `**:${name}`)
      // dynamic paths, including custom patterns, e.g. :id([^/]*)*/suffix
      .replace(/:([^/*]*)/g, (_, name) => `:${name.replace(/\W/g, (r: string) => r === '?' ? '' : '_')}`)

    routes.push(joinURL(prefix, path))

    if (page.children) {
      routes.push(...toRou3Patterns(page.children, joinURL(prefix, path)))
    }
  }
  return routes
}
