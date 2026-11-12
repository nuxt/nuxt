import { existsSync, readdirSync, statSync } from 'node:fs'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addTypeTemplate, defineNuxtModule, findPath, getLayerDirectories, isIgnored, resolvePath, resolveTypePaths, tryUseNitro } from '@nuxt/kit'
import { pageDiagnostics } from '@nuxt/kit/internal'
import { join, relative, resolve } from 'pathe'
import { genInlineTypeImport, genObjectKey, genString, genTypeImport } from 'knitwork'
import { joinURL } from 'ufo'
import { resolveModulePath } from 'exsolve'
import { distDir } from '../dirs.ts'
import { linkToAlias, logger } from '../utils.ts'
import picomatch from 'picomatch'
import { addRoute, createRouter, findRoute } from 'rou3'
import { rou3PatternToURLPattern } from 'unrouting'
import { resolvePagesRoutes as _resolvePagesRoutes, augmentAndResolve, createPagesContext, normalizeRoutes, resolveRoutePaths } from './utils.ts'
import type { PagesContext } from './utils.ts'
import { resolvePageMetaExtractionKeys, shouldExtractSerializablePageMeta } from './page-meta-extraction.ts'
import { collectRou3PagePatterns, collectRou3PageSources, toRou3Patterns, toRou3RoutePatterns } from './route-patterns.ts'
import { findRouterOptionsFileDefining, genRouterOptions, resolveRouterOptions } from './router-options.ts'
import { createInlineRouteRulesUpdater, removePagesRules } from './route-rules.ts'
import { markPagesForRouteRules } from './route-coverage.ts'
import { collectStaticPageRoutes, getAssetPathsForRoute } from './public-assets.ts'
import { setupTypedRouter } from './typed-router.ts'
import { PageMetaPlugin } from './plugins/page-meta.ts'
import { PageComponentNamePlugin } from './plugins/component-name.ts'
import { RouteInjectionPlugin } from './plugins/route-injection.ts'
import { toVirtualId } from '../core/utils/virtual.ts'
import { createNormalizedRouteRulesRouter, normalizeRouteRulePath, resolveRouteRules, resolveRouteRulesRoutes } from '../core/utils/route-rules.ts'
import { setTemplateDiagnosticsRouteMatcher } from '../core/template-diagnostics.ts'
import { getBuiltinComponentMeta } from '../components/builtin-metadata.ts'
import type { NitroInstance, NitroInstanceOptions, NuxtConfig, NuxtPage } from 'nuxt/schema'
import type { InlinePreset } from 'unimport'

const OPTIONAL_PARAM_RE = /^\/?:.*(?:\?|\(\.\*\)\*)$/
const ROOT_CATCHALL_PATTERN_RE = /^\/\*\*(?::[\w-]+)?$/
const RELATIVE_WITH_DOT_RE = /^([^.])/

function relativeWithDot (from: string, to: string) {
  return relative(from, to).replace(RELATIVE_WITH_DOT_RE, './$1') || '.'
}

export const pagesImportPresets: InlinePreset[] = [
  { imports: ['definePageMeta'], from: '#app/composables/pages' },
  { imports: ['PageMeta'], from: '#app/composables/pages', type: true },
  { imports: ['useLink'], from: 'vue-router' },
]

export const routeRulesPresets: InlinePreset[] = [
  { imports: ['defineRouteRules'], from: '#app/composables/pages' },
]

function genRouteRuleExtensions (appMiddlewareType: string) {
  return ['@nuxt/schema', 'nuxt/schema'].flatMap(module => [
    `declare module '${module}' {`,
    '  interface RouteRuleConfigExtensions {',
    `    appMiddleware?: ${appMiddlewareType}`,
    '  }',
    '}',
  ])
}

export default defineNuxtModule({
  meta: {
    name: 'nuxt:pages',
    configKey: 'pages',
  },
  defaults: nuxt => ({
    enabled: typeof nuxt.options.pages === 'boolean' ? nuxt.options.pages : undefined as undefined | boolean,
    pattern: `**/*{${nuxt.options.extensions.join(',')}}` as string | string[],
  }),
  async setup (_options, nuxt) {
    const runtimeDir = resolve(distDir, 'pages/runtime')

    const options = typeof _options === 'boolean' ? { enabled: _options ?? nuxt.options.pages, pattern: `**/*{${nuxt.options.extensions.join(',')}}` } : { ..._options }
    options.pattern = Array.isArray(options.pattern) ? [...new Set(options.pattern)] : options.pattern

    if (nuxt.options.experimental.staticRoutes) {
      const overrides = (nuxt.options._loadOptions as { overrides?: NuxtConfig } | undefined)?.overrides
      const configs = [overrides, ...nuxt.options._layers.map(layer => layer.config)]
      if (!configs.some(config => config?.experimental?.early404 === false)) {
        nuxt.options.experimental.early404 = true
      }
    }

    const updateInlineRouteRules = nuxt.options.experimental.inlineRouteRules ? createInlineRouteRulesUpdater(nuxt) : undefined

    const builtInRouterOptions = await findPath(resolve(runtimeDir, 'router.options')) || resolve(runtimeDir, 'router.options')

    const pagesDirs = getLayerDirectories(nuxt).map(dirs => dirs.appPages)

    // Persistent route tree for incremental dev-mode updates
    const pagesCtx: PagesContext | undefined = nuxt.options.dev
      ? createPagesContext({
          roots: pagesDirs,
          shouldUseServerComponents: !!nuxt.options.experimental.componentIslands,
        })
      : undefined

    const isPagePattern = picomatch(
      Array.isArray(options.pattern) ? options.pattern : [options.pattern],
    )

    /*
     * Page paths as derived by unrouting, captured (keyed by the live page object) before a
     * `definePageMeta` path override replaces them. Typed-pages DTS generation falls back to
     * this path to nest a page whose override is detached from its file parent. Every rebuild
     * emits fresh page objects, so stale entries are garbage-collected with the objects keying
     * them.
     */
    const originalPagePaths = new WeakMap<NuxtPage, string>()

    const handleRouteRules = async (pages: NuxtPage[]) => {
      if (updateInlineRouteRules) {
        await updateInlineRouteRules(pages)
      } else {
        removePagesRules(pages)
      }
      return pages
    }

    const resolvePagesRoutes = async () => handleRouteRules(await _resolvePagesRoutes(options.pattern, nuxt, pagesCtx, originalPagePaths))

    nuxt.options.alias['#vue-router'] = 'vue-router'
    const routerPath = (await resolveTypePaths(['vue-router'], nuxt.options.modulesDir))[0]?.[1] || 'vue-router'
    nuxt.hook('prepare:types', ({ tsConfig }) => {
      tsConfig.compilerOptions ||= {}
      tsConfig.compilerOptions.paths ||= {}
      tsConfig.compilerOptions.paths['#vue-router'] = [routerPath]
      delete tsConfig.compilerOptions.paths['#vue-router/*']
    })

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    const isNonEmptyDir = (dir: string) => existsSync(dir) && readdirSync(dir).length
    const userPreference = options.enabled
    const isPagesEnabled = async () => {
      if (typeof userPreference === 'boolean') {
        return userPreference
      }
      const routerOptionsFiles = await resolveRouterOptions(nuxt, builtInRouterOptions)
      if (routerOptionsFiles.some(p => !p.optional) || pagesDirs.some(dir => isNonEmptyDir(dir))) {
        return true
      }

      const pages = await resolvePagesRoutes()
      if (pages.length) {
        if (nuxt.apps.default) {
          nuxt.apps.default.pages = pages
        }
        return true
      }

      return false
    }
    options.enabled = await isPagesEnabled()
    nuxt.options.pages = options
    // For backwards compatibility with `@nuxtjs/i18n` and other modules that serialize `nuxt.options.pages` directly
    // TODO: remove in a future major
    Object.defineProperty(nuxt.options.pages, 'toString', {
      enumerable: false,
      get: () => () => options.enabled,
    })

    if (nuxt.options.dev && options.enabled) {
      // Add plugin to check if pages are enabled without NuxtPage being instantiated
      addPlugin(resolve(runtimeDir, 'plugins/check-if-page-unused'))
    }

    nuxt.hook('app:templates', (app) => {
      if (!nuxt.options.ssr && app.pages?.some(p => p.mode === 'server')) {
        pageDiagnostics.NUXT_B4008()
      }
    })

    // Restart Nuxt when pages dir is added or removed
    const restartPaths = nuxt.options._layers.flatMap((layer) => {
      const pagesDir = (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options.dir : layer.config.dir)?.pages || 'pages'
      return [
        resolve(layer.config.srcDir || layer.cwd, layer.config.dir?.app || 'app', 'router.options.ts'),
        resolve(layer.config.srcDir || layer.cwd, pagesDir),
      ]
    })

    nuxt.hooks.hook('builder:watch', async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (restartPaths.some(p => p === path || path.startsWith(p + '/'))) {
        const newSetting = await isPagesEnabled()
        if (options.enabled !== newSetting) {
          logger.info('Pages', newSetting ? 'enabled' : 'disabled')
          return nuxt.callHook('restart')
        }
      }
    })

    const componentTypeHelpersPath = resolveModulePath('vue-component-type-helpers', { from: import.meta.url, try: true })

    // layouts can be used without pages (e.g. `<NuxtLayout>`), so always generate their types
    addTypeTemplate({
      filename: 'types/layouts.d.ts',
      dependsOn: [],
      getContents: ({ app, nuxt }) => {
        // a path relative to the generated declaration keeps `buildDir` portable between machines
        const componentTypeHelpers = componentTypeHelpersPath
          ? relativeWithDot(join(nuxt.options.buildDir, 'types'), componentTypeHelpersPath)
          : 'vue-component-type-helpers'

        return [
          genTypeImport('vue', ['ComputedRef', 'MaybeRef']),
          genTypeImport(componentTypeHelpers, ['ComponentProps']),
          '',
          'declare module \'nuxt/app\' {',
          '  interface NuxtLayouts {',
          ...Object.values(app.layouts).map(layout => `    ${genObjectKey(layout.name)}: ComponentProps<${genInlineTypeImport(layout.file)}>`),
          '  }',
          '  export type LayoutKey = keyof NuxtLayouts extends never ? string : keyof NuxtLayouts',
          '  interface PageMeta {',
          '    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false> | {',
          '      [K in LayoutKey]: {',
          '        name?: MaybeRef<K | false> | ComputedRef<K | false>',
          '        props?: NuxtLayouts[K]',
          '      }',
          '    }[LayoutKey]',
          '  }',
          '}',
        ].join('\n')
      },
    })

    if (!options.enabled) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      addTemplate({
        filename: 'pages.mjs',
        dependsOn: [],
        getContents: () => [
          'export { useRoute } from \'#app/composables/router\'',
          'export const START_LOCATION = Symbol(\'router:start-location\')',
        ].join('\n'),
      })
      // used by `<NuxtLink>`
      addTemplate({
        filename: 'router.options.mjs',
        dependsOn: [],
        getContents: () => 'export const hashMode = false\nexport default {}',
      })
      addTypeTemplate({
        filename: 'types/middleware.d.ts',
        dependsOn: [],
        getContents: () => [...genRouteRuleExtensions('string | string[] | Record<string, boolean>'), 'export {}'].join('\n'),
      }, { nuxt: true, nitro: true, node: true })
      addComponent({
        name: 'NuxtPage',
        priority: 10, // built-in that we do not expect the user to override
        filePath: resolve(distDir, 'pages/runtime/page-placeholder'),
        meta: getBuiltinComponentMeta('NuxtPage'),
      })
      // Prerender index if pages integration is not enabled
      nuxt.hook('nitro:init', (nitro) => {
        if (nuxt.options.dev || !nuxt.options.ssr || !nitro.options.static || !nitro.options.prerender.crawlLinks) { return }

        nitro.options.prerender.routes.push('/')
      })
      return
    }

    const useExperimentalTypedPages = nuxt.options.experimental.typedPages
    if (useExperimentalTypedPages) {
      await setupTypedRouter(nuxt, { resolvePages: resolvePagesRoutes, originalPagePaths })
    }

    // Add $router types and vue-router volar plugins
    nuxt.hook('prepare:types', ({ references, tsConfig }) => {
      references.push({ types: useExperimentalTypedPages ? 'vue-router/auto-routes' : 'vue-router' })

      tsConfig.vueCompilerOptions ||= {}
      tsConfig.vueCompilerOptions.plugins ||= []

      // Always add <route> block support
      tsConfig.vueCompilerOptions.plugins.push('vue-router/volar/sfc-route-blocks')

      // Add typed useRoute() when typedPages is enabled
      if (useExperimentalTypedPages) {
        tsConfig.vueCompilerOptions.plugins.push({
          name: 'vue-router/volar/sfc-typed-router',
          options: { rootDir: nuxt.options.rootDir },
        })
      }
    })

    // Add vue-router route guard imports
    nuxt.hook('imports:sources', (sources) => {
      const routerImports = sources.find(s => typeof s === 'object' && 'from' in s && s.from === '#app/composables/router' && s.imports.includes('onBeforeRouteLeave')) as InlinePreset | undefined
      if (routerImports) {
        routerImports.from = 'vue-router'
      }
    })

    // Regenerate templates when adding or removing pages
    const updateTemplatePaths = getLayerDirectories(nuxt)
      .flatMap(dirs => [
        dirs.appPages,
        dirs.appLayouts,
        dirs.appMiddleware,
      ])

    function isPage (file: string, pages = nuxt.apps.default?.pages): boolean {
      if (!pages) { return false }
      return pages.some(page => page.file === file || (page.children && isPage(file, page.children)))
    }

    nuxt.hooks.hookOnce('app:templates', async (app) => {
      app.pages ||= await resolvePagesRoutes()
    })

    nuxt.hook('builder:watch', async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      const shouldAlwaysRegenerate = nuxt.options.experimental.scanPageMeta && isPage(path)

      if (event === 'change' && !shouldAlwaysRegenerate) { return }

      // Attempt incremental tree update for page file add/unlink in dev mode
      const layerIndex = pagesDirs.findIndex(dir => path.startsWith(dir))

      if (pagesCtx && layerIndex !== -1 && !shouldAlwaysRegenerate) {
        try {
          if (event === 'add') {
            const relativeToDir = relative(pagesDirs[layerIndex]!, path)
            if (!isPagePattern(relativeToDir) || isIgnored(path)) { return }
            pagesCtx.addFile(path, layerIndex)
          } else if (event === 'unlink') {
            if (!pagesCtx.removeFile(path)) { return }
          }
          nuxt.apps.default!.pages = await handleRouteRules(await augmentAndResolve(pagesCtx.emit(), pagesCtx.trackedFiles, nuxt, originalPagePaths))
        } catch (err) {
          // Fallback: full rebuild on unexpected tree error
          pageDiagnostics.NUXT_B4012({ event, path, cause: err })
          nuxt.apps.default!.pages = await resolvePagesRoutes()
        }
      } else if (shouldAlwaysRegenerate || updateTemplatePaths.some(dir => path.startsWith(dir))) {
        // Full rebuild: scanPageMeta content change, layout/middleware change, or no pagesCtx
        nuxt.apps.default!.pages = await resolvePagesRoutes()
      }
    })

    nuxt.hook('app:resolve', (app) => {
      // Add default layout for pages
      if (app.mainComponent === resolve(nuxt.options.appDir, 'components/welcome.vue')) {
        app.mainComponent = resolve(runtimeDir, 'app.vue')
      }
      app.middleware.unshift({
        name: 'validate',
        path: resolve(runtimeDir, 'validate'),
        global: true,
      })

      const nitro = tryUseNitro()
      if (nitro && (nitro.options.prerender.crawlLinks || Object.values(nitro.options.routeRules).some(rule => rule.prerender))) {
        app.plugins.push({
          src: resolve(runtimeDir, 'plugins/prerender.server'),
          mode: 'server',
        })
      }
    })

    // Record all pages for use in prerendering
    const prerenderRoutes = new Set<string>()

    function processPages (pages: NuxtPage[], currentPath = '/') {
      for (const page of pages) {
        // Skip internal stub routes (redirects, test routes) from prerendering
        if (page._sync) { continue }

        // Add root of optional dynamic paths and catchalls
        if (OPTIONAL_PARAM_RE.test(page.path) && !page.children?.length) {
          prerenderRoutes.add(currentPath)
        }

        // Skip dynamic paths
        if (page.path.includes(':')) { continue }

        const route = joinURL(currentPath, page.path)
        prerenderRoutes.add(route)

        if (page.children) {
          processPages(page.children, route)
        }
      }
    }

    nuxt.hook('pages:resolved', (pages) => {
      if (nuxt.options.dev) { return }

      prerenderRoutes.clear()
      processPages(pages)
    })

    const warnedConflicts = new Set<string>()
    let publicAssets: NitroInstanceOptions['publicAssets'] = []
    let nitroForRouteCoverage: NitroInstance | undefined
    nuxt.hook('nitro:init', (nitro) => {
      nitroForRouteCoverage = nitro
      const clientBuildDir = resolve(nuxt.options.buildDir, 'dist/client')
      publicAssets = nitro.options.publicAssets.filter((asset) => {
        const dir = resolve(asset.dir)
        return dir !== clientBuildDir && !dir.startsWith(clientBuildDir + '/')
      })
    })

    // Public directories can be large, so check only paths matching known routes.
    nuxt.hook('nitro:build:before', () => {
      for (const [route, page] of collectStaticPageRoutes(nuxt.apps.default?.pages || [])) {
        for (const asset of publicAssets) {
          for (const path of getAssetPathsForRoute(route, asset.baseURL) || []) {
            const file = resolve(asset.dir, path)
            try {
              if (!statSync(file, { throwIfNoEntry: false })?.isFile()) { continue }
            } catch {
              continue
            }

            const key = `${file}:${route}`
            if (warnedConflicts.has(key)) { continue }
            warnedConflicts.add(key)

            pageDiagnostics.NUXT_B4015({
              asset: linkToAlias(file, nuxt),
              route,
              page: page && linkToAlias(page, nuxt),
            })
          }
        }
      }
    })

    // Expose the URLPattern of every page route so pages served without scripts
    // can scope their speculation rules to same-origin *page* navigations, which
    // are safe to GET, instead of a blanket rule that could prefetch/prerender
    // non-idempotent server routes (`~/server/routes/*`). A catch-all page
    // (`[...slug]`) widens this back to a blanket `*`. These stay named
    // (`/products/:id`) rather than using the collapsed early-404 patterns.
    nuxt.hook('nitro:build:before', (nitro) => {
      const urlPatterns = new Set<string>()
      for (const route of toRou3Patterns(nuxt.apps.default?.pages || [])) {
        urlPatterns.add(rou3PatternToURLPattern(route).pattern)
      }
      ;(nitro.options as { _noScriptsPagePatterns?: string[] })._noScriptsPagePatterns = [...urlPatterns]
    })

    // The rou3 patterns the renderer compiles into an early-404 matcher for
    // paths that cannot match any page, before loading the app.
    nuxt.hook('nitro:build:before', async (nitro) => {
      if (!nuxt.options.experimental.early404 || nuxt.options.dev || nuxt.options.router.options.hashMode) { return }

      const blockedRoutes = new Set<string>()
      const patterns = collectRou3PagePatterns(nuxt.apps.default?.pages || [], ['/'], route => blockedRoutes.add(route))
      if (!patterns) {
        pageDiagnostics.NUXT_B4018({ paths: [...blockedRoutes] })
        return
      }

      if (patterns.some(pattern => ROOT_CATCHALL_PATTERN_RE.test(pattern))) {
        pageDiagnostics.NUXT_B4019({})
        return
      }

      const routesFile = await findRouterOptionsFileDefining(nuxt, 'routes', builtInRouterOptions)
      if (routesFile) {
        pageDiagnostics.NUXT_B4020({ file: linkToAlias(routesFile, nuxt) })
        return
      }

      // Patterns and lookups are always case-folded: with `sensitive` routing this can
      // only let a request through to the app (which still 404s), never wrongly 404 it.
      ;(nitro.options as { _early404PagePatterns?: string[] })._early404PagePatterns
        = [...new Set(patterns.map(pattern => normalizeRouteRulePath(pattern, true)))]
    })

    // The page sources the renderer preloads for client-only (`ssr: false`) responses
    nuxt.hook('nitro:build:before', async (nitro) => {
      // lookups ignore trailing slashes, which `strict` routing does not
      const { hashMode, sensitive, strict } = nuxt.options.router.options
      if (nuxt.options.dev || hashMode || strict || !nuxt.apps.default?.pages?.length) { return }
      for (const key of ['routes', 'hashMode', 'history', 'strict', 'sensitive'] as const) {
        if (await findRouterOptionsFileDefining(nuxt, key, builtInRouterOptions)) { return }
      }

      const pageSources = collectRou3PageSources(nuxt.apps.default.pages, nuxt.options.srcDir)
      if (!pageSources) { return }
      // ambiguous patterns stay in the matcher, without sources, so no broader pattern matches their paths
      const sources: Record<string, string[]> = {}
      for (const [pattern, files] of pageSources) {
        const key = normalizeRouteRulePath(pattern, !sensitive)
        sources[key] = files && !(key in sources) ? files : []
      }
      ;(nitro.options as { _spaPageSources?: Record<string, string[]> })._spaPageSources = sources
    })

    if (nuxt.options.experimental.templateDiagnostics) {
      nuxt.hook('app:templatesGenerated', async (app) => {
        setTemplateDiagnosticsRouteMatcher(nuxt, await resolveLinkRouteMatcher(app.pages))
      })
    }

    /** Matches the paths a `<NuxtLink>` can navigate to: page routes and redirecting route rules. */
    async function resolveLinkRouteMatcher (pages?: NuxtPage[]): Promise<((path: string) => boolean) | undefined> {
      const patterns = pages && collectRou3PagePatterns(pages)
      if (!patterns || await findRouterOptionsFileDefining(nuxt, 'routes', builtInRouterOptions)) { return }
      for (const route of resolveRouteRulesRoutes(nuxt).routes) {
        if (route.data.redirect) {
          patterns.push(route.route)
        }
      }
      const fold = !nuxt.options.router.options.sensitive
      const router = createRouter<true>()
      for (const pattern of patterns) {
        addRoute(router, '', normalizeRouteRulePath(pattern, fold), true)
      }
      return path => !!findRoute(router, '', normalizeRouteRulePath(path, fold))
    }

    nuxt.hook('nitro:build:before', (nitro) => {
      if (nuxt.options.dev || nuxt.options.router.options.hashMode) { return }

      nitro.options.ssrRoutes = [
        ...nitro.options.ssrRoutes || [],
        ...toRou3RoutePatterns(nuxt.apps.default?.pages || []),
      ]

      // Inject page patterns that explicitly match `prerender: true` route rule
      if (!nitro.options.static) {
        // Normalise keys and lookups the same way as the compiled `#build/route-rules.mjs`
        // matcher: decode percent-encoding (page routes are encoded, rule keys usually are
        // not), then case-fold unless routing is `sensitive`.
        const caseSensitiveRouteRules = !!nuxt.options.router.options.sensitive
        const routeRulesRouter = createNormalizedRouteRulesRouter(Object.entries(nitro.options.routeRules).map(([route, data]) => ({ route, data })), '', !caseSensitiveRouteRules)
        for (const route of prerenderRoutes) {
          const rules = resolveRouteRules(routeRulesRouter, route, !caseSensitiveRouteRules)
          if (rules.prerender) {
            nitro.options.prerender.routes.push(route)
          }
        }
      }

      if (!nitro.options.static || !nitro.options.prerender.crawlLinks) { return }

      // Only hint the first route when `ssr: true` and no routes are provided
      // as the rest will be injected at runtime when this is prerendered
      if (nuxt.options.ssr) {
        const [firstPage] = [...prerenderRoutes].sort()
        nitro.options.prerender.routes.push(firstPage || '/')
        return
      }

      // Prerender all non-dynamic page routes when generating `ssr: false` app
      for (const route of nitro.options.prerender.routes || []) {
        prerenderRoutes.add(route)
      }
      nitro.options.prerender.routes = Array.from(prerenderRoutes)
    })

    nuxt.hook('imports:sources', (sources) => {
      sources.push(...pagesImportPresets)
      if (nuxt.options.experimental.inlineRouteRules) {
        sources.push(...routeRulesPresets)
      }
    })

    const componentStubPath = await resolvePath(resolve(runtimeDir, 'component-stub'))
    if (nuxt.options.test && nuxt.options.dev) {
      // add component testing route so 404 won't be triggered
      nuxt.hook('pages:extend', (routes) => {
        routes.push({
          _sync: true,
          path: '/__nuxt_component_test__/:pathMatch(.*)',
          file: componentStubPath,
        })
      })
    }

    // Add all redirect paths as valid routes to router; we will handle these in a client-side middleware.
    nuxt.hook('pages:extend', (routes) => {
      let resolvedRoutes: string[]
      for (const route of resolveRouteRulesRoutes(nuxt).routes) {
        if (!route.data.redirect) { continue }
        resolvedRoutes ||= routes.flatMap(route => resolveRoutePaths(route))
        // skip if there's already a route matching this path
        if (resolvedRoutes.includes(route.route)) { continue }
        routes.push({
          _sync: true,
          path: route.route.replace(/\/[^/]*\*\*/, '/:pathMatch(.*)'),
          file: componentStubPath,
        })
      }
    })

    // Extract macros from pages
    const extractedKeys = [...resolvePageMetaExtractionKeys(nuxt.options.experimental.extraPageMetaExtractionKeys)]

    nuxt.hook('modules:done', () => {
      addBuildPlugin(PageMetaPlugin({
        dev: nuxt.options.dev,
        isPage,
        routesId: toVirtualId(resolve(nuxt.options.buildDir, 'routes.mjs'), nuxt),
        extractedKeys: nuxt.options.experimental.scanPageMeta ? extractedKeys : [],
        extractSerializable: shouldExtractSerializablePageMeta(nuxt),
      }))
      if (nuxt.options.experimental.normalizePageNames) {
        addBuildPlugin(PageComponentNamePlugin({ nuxt }))
      }
    })

    // Add prefetching support for middleware & layouts
    addPlugin(resolve(runtimeDir, 'plugins/prefetch.client'))

    // Add build plugin to ensure template $route is kept in sync with `<NuxtPage>`
    if (nuxt.options.experimental.templateRouteInjection) {
      addBuildPlugin(RouteInjectionPlugin(nuxt), { server: false })
    }

    addPlugin(resolve(runtimeDir, 'plugins/router'))

    const getSources = (pages: NuxtPage[]): string[] => pages
      .filter(p => Boolean(p.file))
      .flatMap(p =>
        [relative(nuxt.options.srcDir, p.file as string), ...(p.children?.length ? getSources(p.children) : [])],
      )

    // Do not prefetch page chunks
    nuxt.hook('build:manifest', (manifest) => {
      if (nuxt.options.dev) { return }
      const sourceFiles = nuxt.apps.default?.pages?.length ? getSources(nuxt.apps.default.pages) : []

      for (const [key, chunk] of Object.entries(manifest)) {
        if (chunk.src && Object.values(nuxt.apps).some(app => app.pages?.some(page => page.mode === 'server' && page.file === join(nuxt.options.srcDir, chunk.src!)))) {
          delete manifest[key]
          continue
        }
        if (chunk.isEntry) {
          chunk.dynamicImports =
            chunk.dynamicImports?.filter(i => !sourceFiles.includes(i))
        }
      }
    })

    const resolveRuntimePath = async (path: string) => await findPath(path) ?? path
    const serverComponentRuntime = await resolveRuntimePath(join(distDir, 'components/runtime/server-component'))
    const clientComponentRuntime = await resolveRuntimePath(join(distDir, 'components/runtime/client-component'))
    const routeComponentRuntime = nuxt.options.dev ? undefined : await resolveRuntimePath(join(runtimeDir, 'utils'))

    addTemplate({
      filename: 'routes.mjs',
      // route metadata is extracted from page sources only when `scanPageMeta` is enabled
      dependsOn: nuxt.options.experimental.scanPageMeta ? ['pages'] : [],
      getContents ({ app }) {
        if (!app.pages) { return ROUTES_HMR_CODE + 'export default []' }
        const { routes, imports } = normalizeRoutes(app.pages, new Set(), {
          restrictedPages: markPagesForRouteRules(nuxt, app.pages, nitroForRouteCoverage),
          serverComponentRuntime,
          clientComponentRuntime,
          routeComponentRuntime,
          overrideMeta: !!nuxt.options.experimental.scanPageMeta,
        })
        return ROUTES_HMR_CODE + [...imports, `export default ${routes}`].join('\n')
      },
    })

    // Add vue-router import for `<NuxtLayout>` integration
    addTemplate({
      filename: 'pages.mjs',
      dependsOn: [],
      getContents: () => 'export { START_LOCATION, useRoute } from \'vue-router\'',
    })

    nuxt.options.vite.resolve ||= {}
    nuxt.options.vite.resolve.dedupe ||= []
    nuxt.options.vite.resolve.dedupe.push('vue-router')

    addTemplate({
      filename: 'router.options.mjs',
      dependsOn: [],
      getContents: ({ nuxt }) => genRouterOptions(nuxt, builtInRouterOptions),
    })

    const genMiddlewareKey = (app: { middleware: Array<{ name: string, global?: boolean }> }) =>
      `export type MiddlewareKey = ${app.middleware.filter(mw => !mw.global).map(mw => genString(mw.name)).join(' | ') || 'never'}`

    addTypeTemplate({
      filename: 'types/middleware.d.ts',
      dependsOn: [],
      getContents: ({ app }) => [
        'import type { NavigationGuard } from \'vue-router\'',
        genMiddlewareKey(app),
        'declare module \'nuxt/app\' {',
        '  interface PageMeta {',
        '    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>',
        '  }',
        '}',
      ].join('\n'),
    })

    addTypeTemplate({
      filename: 'types/nitro-middleware.d.ts',
      dependsOn: [],
      getContents: ({ app }) => [
        genMiddlewareKey(app),
        ...genRouteRuleExtensions('MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>'),
      ].join('\n'),
    }, { nuxt: true, nitro: true, node: true })

    // `router.addRoute()` would bypass the build-time route patterns used for early
    // 404 responses, so remove it from the router type. `removeRoute` stays: it only
    // narrows the real route set, which is the safe direction for the matcher.
    const removedRouterMethods = nuxt.options.experimental.staticRoutes
      ? ['addRoute', 'removeRoute', 'clearRoutes']
      : nuxt.options.experimental.early404 ? ['addRoute'] : []
    if (removedRouterMethods.length) {
      addTypeTemplate({
        filename: 'types/router-methods.d.ts',
        dependsOn: [],
        getContents: () => [
          'declare module \'nuxt/app\' {',
          '  interface RemovedRouterMethods {',
          ...removedRouterMethods.map(method => `    ${method}: true`),
          '  }',
          '}',
          'export {}',
        ].join('\n'),
      })
    }

    if (nuxt.options.experimental.viewTransition) {
      addTypeTemplate({
        filename: 'types/view-transitions.d.ts',
        dependsOn: [],
        getContents: () => [
          'import type { ViewTransitionPageOptions } from \'../types/config\'',
          'declare module \'nuxt/app\' {',
          '  interface PageMeta {',
          '    viewTransition?: ViewTransitionPageOptions[\'enabled\'] | ViewTransitionPageOptions',
          '  }',
          '}',
          'export {}',
        ].join('\n'),
      })
    }

    addComponent({
      name: 'NuxtPage',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(distDir, 'pages/runtime/page'),
      meta: getBuiltinComponentMeta('NuxtPage'),
    })
  },
})

const ROUTES_HMR_CODE = /* js */`
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    const router = import.meta.hot.data.router
    const generateRoutes = import.meta.hot.data.generateRoutes
    if (!router || !generateRoutes) {
      import.meta.hot.invalidate('[nuxt] Cannot replace routes because there is no active router. Reloading.')
      return
    }
    const addedRoutes = router.getRoutes().filter(r => !r._initial)
    router.clearRoutes()
    const routes = generateRoutes(mod.default || mod)
    function addRoutes (routes) {
      for (const route of routes) {
        router.addRoute(route)
      }
      for (const route of router.getRoutes()) {
        route._initial = true
      }
      for (const route of addedRoutes) {
        router.addRoute(route)
      }
      router.isReady().then(() => {
        // Resolve the current path against the new routes to get updated meta
        const newRoute = router.resolve(router.currentRoute.value.fullPath)
        // Clear old meta values and assign new ones
        for (const key of Object.keys(router.currentRoute.value.meta)) {
          delete router.currentRoute.value.meta[key]
        }
        Object.assign(router.currentRoute.value.meta, newRoute.meta)
      })
    }
    if (routes && 'then' in routes) {
      routes.then(addRoutes)
    } else {
      addRoutes(routes)
    }
  })
}

export function handleHotUpdate(_router, _generateRoutes) {
  if (import.meta.hot) {
    import.meta.hot.data ||= {}
    import.meta.hot.data.router = _router
    import.meta.hot.data.generateRoutes = _generateRoutes
    for (const route of _router.getRoutes()) {
      route._initial = true
    }
  }
}
`
