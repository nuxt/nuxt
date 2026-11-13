import fs from 'node:fs'

import { normalize, relative } from 'pathe'
import { joinURL } from 'ufo'
import { getLayerDirectories, resolveFiles, resolvePath, tryUseNuxt, useNuxt } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { genArrayFromRaw, genDynamicImport, genImport, genSafeVariableName } from 'knitwork'
import { filename } from 'pathe/utils'
import { hash } from 'ohash'
import { defu } from 'defu'
import { addFile, buildTree, compileParsePath, removeFile, toVueRouter4 } from 'unrouting'
import type { BuildTreeOptions, InputFile, RouteTree, VueRouterEmitOptions } from 'unrouting'

import { linkToAlias, toArray } from '../utils.ts'
import { defaultExtractionKeys, dynamicPageMetaCache, getDynamicMetaKeys, getDynamicPageMeta, getRouteMeta, shouldExtractSerializablePageMeta } from './page-meta-extraction.ts'
import type { Nuxt, NuxtPage } from 'nuxt/schema'

/** A persistent route tree, updated incrementally as page files are added and removed in development. */
export interface PagesContext {
  /** Emit NuxtPage[] from the current tree state. */
  emit: () => NuxtPage[]
  /** Add a file to the tree (incremental). */
  addFile: (filePath: string, priority?: number) => void
  /** Remove a file from the tree. Returns `true` if the file was found and removed. */
  removeFile: (filePath: string) => boolean
  /** Replace the tree contents from a fresh file list. */
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

/** Scan the pages directories of every layer and resolve the full route tree. */
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

  const pagesCtx = ctx ?? createPagesContext({ roots: pagesDirs, shouldUseServerComponents: !!nuxt.options.experimental.componentIslands })
  pagesCtx.rebuild(inputFiles)

  return augmentAndResolve(pagesCtx.emit(), pagesCtx.trackedFiles, nuxt, originalPagePaths)
}

/** Augment pages with their extracted page metadata and run the `pages:extend` and `pages:resolved` hooks. */
export async function augmentAndResolve (pages: NuxtPage[], trackedFiles: Set<string>, nuxt = useNuxt(), originalPagePaths?: WeakMap<NuxtPage, string>): Promise<NuxtPage[]> {
  const shouldAugment = nuxt.options.experimental.scanPageMeta || nuxt.options.experimental.typedPages

  if (shouldAugment === false) {
    await nuxt.callHook('pages:extend', pages)
    return pages
  }

  const generatedNames = recordRouteNames(pages)
  const augmentCtx = {
    extraExtractionKeys: new Set([
      'middleware',
      ...nuxt.options.experimental.extraPageMetaExtractionKeys || [],
    ]),
    extractSerializable: shouldExtractSerializablePageMeta(nuxt),
    fullyResolvedPaths: trackedFiles,
    originalPagePaths,
    nuxt,
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

  warnOnDuplicateRouteNames(pages, generatedNames, dynamicPageMetaCache(nuxt))

  return pages
}

function recordRouteNames (routes: NuxtPage[], names = new WeakMap<NuxtPage, string | undefined>()) {
  for (const route of routes) {
    names.set(route, route.name)
    if (route.children) {
      recordRouteNames(route.children, names)
    }
  }
  return names
}

interface NamedRoute {
  route: NuxtPage
  file: string
  path: string
}

/**
 * Warn when a route name is reused, as Vue Router replaces the earlier route with that name.
 * Collisions between names that are all still generated from file paths are left to `NUXT_B4004`.
 */
function warnOnDuplicateRouteNames (pages: NuxtPage[], generatedNames: WeakMap<NuxtPage, string | undefined>, dynamicPageMeta: Map<string, ReadonlySet<string>>) {
  const isExplicit = (route: NuxtPage) => !generatedNames.has(route) || generatedNames.get(route) !== route.name
  const seen = new Map<string, NamedRoute>()

  function walk (routes: NuxtPage[], parentPath: string) {
    for (const route of routes) {
      const path = route.path.startsWith('/') ? route.path : joinURL(parentPath, route.path)
      if (route.name && route.file && !getDynamicPageMeta(route, dynamicPageMeta).has('name')) {
        const existing = seen.get(route.name)
        if (existing && existing.route !== route && (isExplicit(route) || isExplicit(existing.route))) {
          pageDiagnostics.NUXT_B4028({
            name: route.name,
            path,
            file: linkToAlias(route.file),
            existingPath: existing.path,
            existingFile: linkToAlias(existing.file),
          })
        }
        seen.set(route.name, { route, file: route.file, path })
      }
      if (route.children?.length) {
        walk(route.children, path)
      }
    }
  }

  walk(pages, '/')
}

interface AugmentPagesContext {
  fullyResolvedPaths?: Set<string>
  pagesToSkip?: Set<string>
  augmentedPages?: Set<string>
  extraExtractionKeys?: Set<string>
  extractSerializable?: boolean
  originalPagePaths?: WeakMap<NuxtPage, string>
  /** Owner of the dynamic page meta recorded during augmentation. */
  nuxt?: Nuxt | null
}

export async function augmentPages (routes: NuxtPage[], vfs: Record<string, string>, ctx: AugmentPagesContext = {}) {
  ctx.augmentedPages ??= new Set()
  const dynamicPageMeta = dynamicPageMetaCache(ctx.nuxt ?? tryUseNuxt())
  for (const route of routes) {
    if (route.file && !ctx.pagesToSkip?.has(route.file)) {
      const fileContent = vfs[route.file] ?? fs.readFileSync(ctx.fullyResolvedPaths?.has(route.file) ? route.file : await resolvePath(route.file), 'utf-8')
      const routeMeta = getRouteMeta(fileContent, route.file, ctx.extraExtractionKeys, { extractSerializable: ctx.extractSerializable })
      const dynamic = getDynamicMetaKeys(route.file, ctx.extraExtractionKeys, { extractSerializable: ctx.extractSerializable })
      if (dynamic.size) {
        dynamicPageMeta.set(normalize(route.file), dynamic)
      } else {
        dynamicPageMeta.delete(normalize(route.file))
      }
      if (route.meta) {
        routeMeta.meta = defu({}, routeMeta.meta, route.meta)
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

/** Page files whose component can have `__name` rewritten by the build-time transform. */
const PAGE_COMPONENT_FILE_RE = /\.vue$/

/**
 * Map each transformable page file to the `__name` to assign to its component at build time.
 * A file is omitted, or mapped to `undefined`, when its route name cannot be known until runtime
 * (a dynamic `definePageMeta` name, `scanPageMeta` disabled, several routes sharing the file with
 * different names, or a non-component file), so the runtime assignment keeps applying to it.
 */
export function getPageComponentNames (pages: NuxtPage[], nuxt = useNuxt()): Map<string, string | undefined> {
  const pageNames = new Map<string, string | undefined>()
  if (!nuxt || !nuxt.options.experimental.scanPageMeta) {
    return pageNames
  }
  const dynamicPageMeta = dynamicPageMetaCache(nuxt)
  const namedViews = new Set<string>()
  const visit = (page: NuxtPage) => {
    if (page.file && PAGE_COMPONENT_FILE_RE.test(page.file)) {
      const file = normalize(page.file)
      const name = page.name && !getDynamicPageMeta(page, dynamicPageMeta).has('name') && !isSymlink(file)
        ? page.name
        : undefined
      if (!pageNames.has(file)) {
        pageNames.set(file, name)
      } else if (pageNames.get(file) !== name) {
        // Several routes can reuse one file under different names; a single build-time name
        // cannot express both.
        pageNames.set(file, undefined)
      }
    }
    for (const [view, viewFile] of Object.entries(page.components || {})) {
      if (view !== 'default' && PAGE_COMPONENT_FILE_RE.test(viewFile)) {
        namedViews.add(normalize(viewFile))
      }
    }
    if (page.children?.length) {
      for (const child of page.children) { visit(child) }
    }
  }
  for (const page of pages) { visit(page) }
  // The runtime assignment only renames the resolved default (or its client clone), never a
  // named view's component, so a file shared with a named view keeps it.
  for (const file of namedViews) {
    pageNames.set(file, undefined)
  }
  return pageNames
}

function isSymlink (file: string): boolean {
  try {
    return normalize(fs.realpathSync(file)) !== file
  } catch {
    return false
  }
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
  /** Module exporting `memoizeRouteComponent`, used to share lazy page imports between server requests. */
  routeComponentRuntime?: string
  /** Page files with a build-time `__name`, threaded through nested routes. */
  pageComponentNames?: Map<string, string | undefined>
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

interface PageComponentName {
  /** Expression resolving to the route name assigned as `__name`. */
  name: string
  /** Identifier of the statically imported page component, if the page is imported synchronously. */
  syncImport?: string
}

function normalizeComponent (page: NuxtPage, pageImport: string, routeName: string | undefined, islandKey: string | undefined, assignName?: PageComponentName): string {
  const withName = (component: string) => `Object.assign(${component}, { __name: ${assignName!.name} })`
  if (assignName?.syncImport) {
    return withName(assignName.syncImport)
  }
  // Server components already receive the name via createIslandPage(name)
  if (page.mode === 'server') {
    return `() => createIslandPage(${routeName}, import.meta.server ? ${islandKey} : undefined)`
  }
  // Dropping the loader on the server keeps the page chunk out of that bundle;
  // `createClientPage` falls back to a placeholder without it.
  if (page.mode === 'client') {
    const component = `() => createClientPage(import.meta.client ? ${pageImport} : undefined)`
    return assignName ? `${component}.then((c) => ${withName('c')})` : component
  }
  return assignName ? `${pageImport}.then((m) => ${withName('m.default')})` : pageImport
}

export function normalizeRoutes (routes: NuxtPage[], metaImports: Set<string> = new Set(), options: NormalizeRoutesOptions): { imports: Set<string>, routes: string } {
  const nuxt = useNuxt()
  const dynamicPageMeta = dynamicPageMetaCache(nuxt)
  const pageNames = options.pageComponentNames ?? getPageComponentNames(routes, nuxt)
  return {
    imports: metaImports,
    routes: genArrayFromRaw(routes.map((page) => {
      const markedDynamic = getDynamicPageMeta(page, dynamicPageMeta)
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
        route.children = normalizeRoutes(page.children, metaImports, { ...options, pageComponentNames: pageNames }).routes
      }

      // Without a file, we can't use `definePageMeta` to extract route-level meta from the file
      if (!page.file) {
        return route
      }

      const file = normalize(page.file)
      const relativeFile = relative(nuxt.options.rootDir, file)
      const pageImportName = genSafeVariableName(filename(file) + hash(relativeFile).replace(/-/g, '_'))
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
      const islandKey = page.mode === 'server'
        ? JSON.stringify(hash(relativeFile))
        : undefined

      // A page whose name is known at build time already carries it in its own chunk, so the
      // route table can import it without mutating it here.
      const assignName = nuxt.options.experimental.normalizePageNames && pageNames.get(file) === undefined
        ? { name: metaRouteName, syncImport: isSyncImport ? pageImportName : undefined }
        : undefined
      let component = restrictToEnvironment(normalizeComponent(page, pageImport, route.name, islandKey, assignName))
      if (options.routeComponentRuntime && !isSyncImport) {
        metaImports.add(genImport(options.routeComponentRuntime, [{ name: 'memoizeRouteComponent', as: '_memoizeRouteComponent' }]))
        component = `import.meta.server ? _memoizeRouteComponent(${component}) : ${component}`
      }

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
