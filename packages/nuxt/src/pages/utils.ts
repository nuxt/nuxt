import fs from 'node:fs'

import { normalize, relative } from 'pathe'
import { joinURL } from 'ufo'
import { getLayerDirectories, resolveFiles, resolvePath, useNuxt } from '@nuxt/kit'
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
import { logger, toArray } from '../utils.ts'
import { tokenizePath } from './vue-router.ts'
import type { VueRouterPathParamToken as RoutePathParamToken, VueRouterPathToken as RoutePathToken } from './vue-router.ts'
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
    warn: msg => logger.warn(msg),
  }
  const emitOptions: VueRouterEmitOptions = {
    onDuplicateRouteName: (_name, file, existingFile) => {
      logger.warn(`Route name generated for \`${file}\` is the same as \`${existingFile}\`. You may wish to set a custom name using \`definePageMeta\` within the page file.`)
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

export async function resolvePagesRoutes (pattern: string | string[], nuxt = useNuxt(), ctx?: PagesContext): Promise<NuxtPage[]> {
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

  return augmentAndResolve(pages, ctx?.trackedFiles ?? new Set(inputFiles.map(f => f.path)), nuxt)
}

// ---------------------------------------------------------------------------
// augmentAndResolve — downstream pipeline (augmentation + hooks)
// ---------------------------------------------------------------------------

export async function augmentAndResolve (pages: NuxtPage[], trackedFiles: Set<string>, nuxt = useNuxt()): Promise<NuxtPage[]> {
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
    fullyResolvedPaths: trackedFiles,
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
}

export async function augmentPages (routes: NuxtPage[], vfs: Record<string, string>, ctx: AugmentPagesContext = {}) {
  ctx.augmentedPages ??= new Set()
  for (const route of routes) {
    if (route.file && !ctx.pagesToSkip?.has(route.file)) {
      const fileContent = vfs[route.file] ?? fs.readFileSync(ctx.fullyResolvedPaths?.has(route.file) ? route.file : await resolvePath(route.file), 'utf-8')
      const routeMeta = getRouteMeta(fileContent, route.file, ctx.extraExtractionKeys)
      if (route.meta) {
        routeMeta.meta = defu({}, routeMeta.meta, route.meta)
      }
      if (route.rules) {
        routeMeta.rules = defu({}, routeMeta.rules, route.rules)
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

const SFC_SCRIPT_RE = /<script(?=\s|>)(?<attrs>[^>]*)>(?<content>[\s\S]*?)<\/script\s*>/gi
export function extractScriptContent (sfc: string) {
  const contents: Array<{ loader: 'tsx' | 'ts', code: string }> = []
  for (const match of sfc.matchAll(SFC_SCRIPT_RE)) {
    if (match?.groups?.content) {
      contents.push({
        loader: match.groups.attrs && /[tj]sx/.test(match.groups.attrs) ? 'tsx' : 'ts',
        code: match.groups.content.trim(),
      })
    }
  }

  return contents
}

const PAGE_META_MACRO_NAMES = ['definePageMeta', 'defineRouteRules'] as const
// Cheap pre-scan only. The AST walk below validates call expressions so this
// intentionally matches macro names, not JavaScript/TypeScript call syntax.
const PAGE_EXTRACT_RE = new RegExp(`\\b(${PAGE_META_MACRO_NAMES.join('|')})\\b`, 'g')
export const defaultExtractionKeys = ['name', 'path', 'props', 'alias', 'redirect', 'middleware'] as const
const DYNAMIC_META_KEY = '__nuxt_dynamic_meta_key' as const

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

const pageContentsCache: Record<string, string> = {}
const extractCache: Record<string, Partial<Record<keyof NuxtPage, any>>> = {}
export function getRouteMeta (contents: string, absolutePath: string, extraExtractionKeys: Set<string> = new Set()): Partial<Record<keyof NuxtPage, any>> {
  // set/update pageContentsCache, invalidate extractCache on cache mismatch
  if (!(absolutePath in pageContentsCache) || pageContentsCache[absolutePath] !== contents) {
    pageContentsCache[absolutePath] = contents
    delete extractCache[absolutePath]
  }

  if (absolutePath in extractCache && extractCache[absolutePath]) {
    return klona(extractCache[absolutePath])
  }

  const loader = getLoader(absolutePath)
  const scriptBlocks = !loader ? null : loader === 'vue' ? extractScriptContent(contents) : [{ code: contents, loader }]
  if (!scriptBlocks) {
    extractCache[absolutePath] = {}
    return {}
  }

  const extractedData: Partial<Record<keyof NuxtPage, any>> = {}

  const extractionKeys = new Set<keyof NuxtPage>([...defaultExtractionKeys, ...extraExtractionKeys as Set<keyof NuxtPage>])

  for (const script of scriptBlocks) {
    const found: Record<string, boolean> = {}
    // properties track which macros need to be extracted
    for (const macro of script.code.matchAll(PAGE_EXTRACT_RE)) {
      found[macro[1]!] = false
    }

    if (Object.keys(found).length === 0) {
      continue
    }

    const dynamicProperties = new Set<keyof NuxtPage>()

    parseAndWalk(script.code, absolutePath.replace(/\.\w+$/, '.' + script.loader), (node) => {
      if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression' || node.expression.callee.type !== 'Identifier') { return }

      // function name is one of the extracted macro functions and not yet found
      const fnName = node.expression.callee.name
      if (fnName in found === false || found[fnName] !== false) { return }
      found[fnName] = true

      const code = script.code
      const pageExtractArgument = unwrapStaticExpression(node.expression.arguments[0])

      if (pageExtractArgument?.type !== 'ObjectExpression') {
        logger.warn(`\`${fnName}\` must be called with an object literal (reading \`${absolutePath}\`), found ${pageExtractArgument?.type} instead.`)
        return
      }

      if (fnName === 'defineRouteRules') {
        const { value, serializable } = isSerializable(code, pageExtractArgument)
        if (!serializable) {
          logger.warn(`\`${fnName}\` must be called with a serializable object literal (reading \`${absolutePath}\`).`)
          return
        }

        extractedData.rules = value
        return
      }

      if (fnName === 'definePageMeta') {
        for (const key of extractionKeys) {
          const property = pageExtractArgument.properties.find((property): property is ESTree.ObjectProperty => property.type === 'Property' && property.key.type === 'Identifier' && property.key.name === key)
          if (!property) { continue }

          const { value, serializable } = isSerializable(code, property.value)
          if (!serializable) {
            logger.debug(`Skipping extraction of \`${key}\` metadata as it is not JSON-serializable (reading \`${absolutePath}\`).`)
            dynamicProperties.add(extraExtractionKeys.has(key) ? 'meta' : key)
            continue
          }

          if (extraExtractionKeys.has(key)) {
            extractedData.meta ??= {}
            extractedData.meta[key] = value
          } else {
            extractedData[key] = value
          }
        }

        for (const property of pageExtractArgument.properties) {
          if (property.type !== 'Property') {
            continue
          }
          const isIdentifierOrLiteral = property.key.type === 'Literal' || property.key.type === 'Identifier'
          if (!isIdentifierOrLiteral) {
            continue
          }
          const name = property.key.type === 'Identifier' ? property.key.name : String(property.value)
          if (!extractionKeys.has(name as keyof NuxtPage)) {
            dynamicProperties.add('meta')
            break
          }
        }

        if (dynamicProperties.size) {
          extractedData.meta ??= {}
          extractedData.meta[DYNAMIC_META_KEY] = dynamicProperties
        }
      }
    })
  }

  extractCache[absolutePath] = extractedData
  return klona(extractedData)
}

function serializeRouteValue (value: any, skipSerialisation = false) {
  if (skipSerialisation || value === undefined) { return undefined }
  return JSON.stringify(value)
}

type NormalizedRoute = Partial<Record<Exclude<keyof NuxtPage, 'file'>, string>> & { component?: string }
type NormalizedRouteKeys = (keyof NormalizedRoute)[]
interface NormalizeRoutesOptions {
  overrideMeta?: boolean
  serverComponentRuntime: string
  clientComponentRuntime: string
}

function normalizeComponent (page: NuxtPage, pageImport: string, routeName: string | undefined, islandKey: string | undefined): string {
  if (page.mode === 'server') {
    return `() => createIslandPage(${routeName}, import.meta.server ? ${islandKey} : undefined)`
  }
  if (page.mode === 'client') {
    return `() => createClientPage(${pageImport})`
  }
  return pageImport
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
    return `() => createClientPage(${pageImport}).then((c) => Object.assign(c, { __name: ${metaRouteName} }))`
  }
  return `${pageImport}.then((m) => Object.assign(m.default, { __name: ${metaRouteName} }))`
}

export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set(), options: NormalizeRoutesOptions): { imports: Set<string>, routes: string } {
  const nuxt = useNuxt()
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const markedDynamic = page.meta?.[DYNAMIC_META_KEY] ?? new Set()
      const metaFiltered: Record<string, any> = {}
      let skipMeta = true
      for (const key in page.meta || {}) {
        if (key !== DYNAMIC_META_KEY && page.meta![key] !== undefined) {
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
      metaImports.add(genImport(`${file}?macro=true`, [{ name: 'default', as: metaImportName }]))

      if (page._sync) {
        metaImports.add(genImport(file, [{ name: 'default', as: pageImportName }]))
      }

      const isSyncImport = page._sync && page.mode !== 'client'
      const pageImport = isSyncImport ? pageImportName : genDynamicImport(file)
      const metaRouteName = `${metaImportName}?.name ?? ${route.name}`

      // we use this to validate that a server page is rendering the correct url
      const islandKey = page.mode === 'server' && page.file
        ? JSON.stringify(hash(relative(nuxt.options.rootDir, page.file)))
        : undefined

      const component = nuxt.options.experimental.normalizePageNames
        ? normalizeComponentWithName(page, isSyncImport, pageImportName, pageImport, route.name, metaRouteName, islandKey)
        : normalizeComponent(page, pageImport, route.name, islandKey)

      // Named views from the `name@view.vue` filename convention. The scanner
      // emits `components: { default: <file>, <view>: <file> }`.
      // https://router.vuejs.org/guide/essentials/named-views.html
      let componentsObject: string | undefined
      if (page.components) {
        const viewEntries: string[] = []
        for (const viewName in page.components) {
          if (viewName === 'default') { continue }
          const viewFile = normalize(page.components[viewName]!)
          viewEntries.push(`${JSON.stringify(viewName)}: ${genDynamicImport(viewFile)}`)
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

      return metaRoute
    })),
  }
}

interface PathToNitroGlobOptions {
  warn?: (message: string) => void
  maxExpandedPaths?: number
}

interface SegmentResolution {
  type: 'exact' | 'fallback'
  segments?: string[]
  warn?: boolean
  reason?: string
}

const DEFAULT_MAX_ROUTE_RULE_GLOBS = 64
const REGEXP_LITERAL_ESCAPE_CHARS = new Set(['.', '+', '*', '?', '^', '$', '(', ')', '[', ']', '{', '}', '|', '\\'])

function isSafeRouteRuleAlternativeChar (char: string) {
  const code = char.charCodeAt(0)
  return (code >= 65 && code <= 90) // A-Z
    || (code >= 97 && code <= 122) // a-z
    || (code >= 48 && code <= 57) // 0-9
    || char === '_'
    || char === '-'
    || char === '~'
}

function getFiniteParamAlternatives (token: RoutePathParamToken) {
  if (!token.regexp || token.repeatable) {
    return null
  }

  const alternatives: string[] = []
  let buffer = ''
  let escaped = false
  for (const char of token.regexp) {
    if (escaped) {
      if (!REGEXP_LITERAL_ESCAPE_CHARS.has(char)) {
        return null
      }
      buffer += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '|') {
      if (!buffer) { return null }
      alternatives.push(buffer)
      buffer = ''
    } else if (isSafeRouteRuleAlternativeChar(char)) {
      buffer += char
    } else {
      return null
    }
  }

  if (escaped) { return null }
  if (!buffer) { return null }
  alternatives.push(buffer)

  if (token.optional) {
    alternatives.push('')
  }

  return alternatives
}

function isExpectedDynamicFallback (token: RoutePathParamToken) {
  if (!token.regexp) {
    return true
  }

  return token.regexp === '[^/]+'
    || token.regexp === '.*'
    || (token.repeatable && token.regexp === '[^/]*')
}

function countUnresolvedRouteParams (segments: RoutePathToken[][]) {
  let count = 0
  for (const segment of segments) {
    for (const token of segment) {
      if (token.type === 'param' && !getFiniteParamAlternatives(token)) {
        count++
      }
    }
  }
  return count
}

function resolveRouteRuleSegment (segment: RoutePathToken[], maxExpandedPaths: number): SegmentResolution {
  if (!segment.length) {
    return { type: 'exact', segments: [''] }
  }

  const paramTokens = segment.filter((token): token is RoutePathParamToken => token.type === 'param')

  if (!paramTokens.length) {
    return resolveExactSegments([segment.map(token => token.value).join('')])
  }

  if (segment.length === 1) {
    const token = segment[0] as RoutePathParamToken
    const alternatives = getFiniteParamAlternatives(token)
    if (alternatives) {
      return resolveExactSegments(alternatives)
    }
    return isExpectedDynamicFallback(token)
      ? { type: 'fallback' }
      : { type: 'fallback', warn: true, reason: `custom RegExp constraint for parameter \`${token.value}\` cannot be represented by Nitro route rules` }
  }

  let alternatives = ['']
  for (const token of segment) {
    if (token.type === 'static') {
      alternatives = alternatives.map(alternative => alternative + token.value)
      continue
    }

    const paramAlternatives = getFiniteParamAlternatives(token)
    if (!paramAlternatives) {
      return {
        type: 'fallback',
        warn: true,
        reason: `partial dynamic segment \`${stringifyRouteRuleSegment(segment)}\` cannot be represented by Nitro route rules`,
      }
    }

    if (alternatives.length * paramAlternatives.length > maxExpandedPaths) {
      return { type: 'fallback', warn: true, reason: 'finite route alternatives exceed the expansion limit' }
    }

    alternatives = alternatives.flatMap(alternative => paramAlternatives.map(paramAlternative => alternative + paramAlternative))
  }

  return resolveExactSegments(alternatives)
}

// Escape the finite literal segments for Nitro, falling back if any cannot be represented as a rou3 static route.
function resolveExactSegments (segments: string[]): SegmentResolution {
  const unsupportedSegment = segments.find(segment => !canRepresentNitroStaticSegment(segment))
  if (unsupportedSegment != null) {
    return {
      type: 'fallback',
      warn: true,
      reason: `static segment \`${unsupportedSegment}\` cannot be represented by Nitro route rules`,
    }
  }
  return { type: 'exact', segments: segments.map(escapeNitroStaticSegment) }
}

function stringifyRouteRuleSegment (segment: RoutePathToken[]) {
  return segment.map((token) => {
    if (token.type === 'static') {
      return token.value
    }
    return `:${token.value}${token.regexp ? `(${token.regexp})` : ''}${token.repeatable ? token.optional ? '*' : '+' : token.optional ? '?' : ''}`
  }).join('')
}

function escapeNitroStaticSegment (segment: string) {
  let escaped = ''
  for (const char of segment) {
    escaped += char === ':' || char === '(' || char === ')' || char === '{' || char === '}' || char === '*'
      ? `\\${char}`
      : char
  }
  return escaped
}

function canRepresentNitroStaticSegment (segment: string) {
  return !segment.includes('*') || segment === '*' || segment === '**'
}

function appendRouteRuleSegment (path: string, segment: string) {
  if (!segment) {
    return path
  }
  return `${path || ''}/${segment}`
}

function toNitroFallbackGlob (path: string) {
  return path ? `${path}/**` : '/**'
}

function routeRuleGlobCovers (glob: string, other: string) {
  if (glob === other || glob === '/**') {
    return true
  }
  if (!glob.endsWith('/**') || !other.endsWith('/**')) {
    return false
  }
  return other.startsWith(`${glob.slice(0, -3)}/`)
}

function collapseRouteRuleFallbackGlobs (paths: string[]) {
  const globs = [...new Set(paths.map(toNitroFallbackGlob))]
  return globs.filter(glob => !globs.some(other => other !== glob && routeRuleGlobCovers(other, glob)))
}

function warnRouteRuleFallback (path: string, globs: string[], reason: string | undefined, warn: PathToNitroGlobOptions['warn']) {
  if (!warn) { return }
  warn(`Inline route rules for \`${path}\` were mapped to ${globs.map(glob => `\`${glob}\``).join(', ')}, which is broader than the page route.${reason ? ` ${reason}.` : ''}`)
}

export function pathToNitroGlob (path: string, options: PathToNitroGlobOptions = {}) {
  return pathToNitroGlobs(path, options)?.[0] || null
}

export function pathToNitroGlobs (path: string, options: PathToNitroGlobOptions = {}) {
  if (!path) {
    return null
  }

  const maxExpandedPaths = options.maxExpandedPaths ?? DEFAULT_MAX_ROUTE_RULE_GLOBS
  let segments: RoutePathToken[][]
  try {
    segments = tokenizePath(path)
  } catch (error) {
    options.warn?.(`Inline route rules for \`${path}\` could not be mapped and were skipped. ${error instanceof Error ? error.message : String(error)}`)
    return null
  }

  if (countUnresolvedRouteParams(segments) > 1) {
    options.warn?.(`Inline route rules for \`${path}\` could not be mapped and were skipped because multiple dynamic params cannot be represented by a single Nitro route rule glob.`)
    return null
  }

  let paths = ['']
  for (const segment of segments) {
    const resolved = resolveRouteRuleSegment(segment, maxExpandedPaths)
    if (resolved.type === 'fallback') {
      const rawGlobs = [...new Set(paths.map(toNitroFallbackGlob))]
      const globs = collapseRouteRuleFallbackGlobs(paths)
      if (resolved.warn || rawGlobs.length !== globs.length) {
        warnRouteRuleFallback(path, globs, resolved.reason || 'fallback route alternatives collapse to a broader Nitro route rule glob', options.warn)
      }
      return globs
    }

    if (paths.length * resolved.segments!.length > maxExpandedPaths) {
      const globs = collapseRouteRuleFallbackGlobs(paths)
      warnRouteRuleFallback(path, globs, 'finite route alternatives exceed the expansion limit', options.warn)
      return globs
    }

    paths = paths.flatMap(path => resolved.segments!.map(segment => appendRouteRuleSegment(path, segment)))
  }

  const globs = [...new Set(paths.map(path => path || '/'))]
  return globs.length ? globs : null
}

export function resolveRoutePaths (page: NuxtPage, parent = '/'): string[] {
  return [
    joinURL(parent, page.path),
    ...page.children?.flatMap(child => resolveRoutePaths(child, joinURL(parent, page.path))) || [],
  ]
}

export function isSerializable (code: string, node: ESTree.Node): { value?: any, serializable: boolean } {
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
      const { serializable, value } = isSerializable(code, element)
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
      const { serializable, value: propertyValue } = isSerializable(code, property.value)
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
