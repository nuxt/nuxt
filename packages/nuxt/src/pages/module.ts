import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addTypeTemplate, defineNuxtModule, findPath, logger, resolvePath, updateTemplates, useNitro } from '@nuxt/kit'
import { dirname, join, relative, resolve } from 'pathe'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { joinURL } from 'ufo'
import type { Nuxt, NuxtApp, NuxtPage } from 'nuxt/schema'
import { createRoutesContext } from 'unplugin-vue-router'
import { resolveOptions } from 'unplugin-vue-router/options'
import type { EditableTreeNode, Options as TypedRouterOptions } from 'unplugin-vue-router'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'

import type { NitroRouteConfig } from 'nitro/types'
import { defu } from 'defu'
import { distDir } from '../dirs'
import { resolveTypePath } from '../core/utils/types'
import { normalizeRoutes, resolvePagesRoutes, resolveRoutePaths } from './utils'
import { extractRouteRules, getMappedPages } from './route-rules'
import { PageMetaPlugin } from './plugins/page-meta'
import { RouteInjectionPlugin } from './plugins/route-injection'

const OPTIONAL_PARAM_RE = /^\/?:.*(?:\?|\(\.\*\)\*)$/

export default defineNuxtModule({
  meta: {
    name: 'pages',
  },
  async setup (_options, nuxt) {
    const useExperimentalTypedPages = nuxt.options.experimental.typedPages
    const runtimeDir = resolve(distDir, 'pages/runtime')
    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || 'pages'),
    )

    nuxt.options.alias['#vue-router'] = 'vue-router'
    const routerPath = await resolveTypePath('vue-router', '', nuxt.options.modulesDir) || 'vue-router'
    nuxt.hook('prepare:types', ({ tsConfig }) => {
      tsConfig.compilerOptions ||= {}
      tsConfig.compilerOptions.paths ||= {}
      tsConfig.compilerOptions.paths['#vue-router'] = [routerPath]
      delete tsConfig.compilerOptions.paths['#vue-router/*']
    })

    async function resolveRouterOptions () {
      const context = {
        files: [] as Array<{ path: string, optional?: boolean }>,
      }

      for (const layer of nuxt.options._layers) {
        const path = await findPath(resolve(layer.config.srcDir, layer.config.dir?.app || 'app', 'router.options'))
        if (path) { context.files.unshift({ path }) }
      }

      // Add default options at beginning
      context.files.unshift({ path: await findPath(resolve(runtimeDir, 'router.options')) || resolve(runtimeDir, 'router.options'), optional: true })

      await nuxt.callHook('pages:routerOptions', context)
      return context.files
    }

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    const isNonEmptyDir = (dir: string) => existsSync(dir) && readdirSync(dir).length
    const userPreference = nuxt.options.pages
    const isPagesEnabled = async () => {
      if (typeof userPreference === 'boolean') {
        return userPreference
      }
      const routerOptionsFiles = await resolveRouterOptions()
      if (routerOptionsFiles.filter(p => !p.optional).length > 0) {
        return true
      }
      if (pagesDirs.some(dir => isNonEmptyDir(dir))) {
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
    nuxt.options.pages = await isPagesEnabled()

    if (nuxt.options.dev && nuxt.options.pages) {
      // Add plugin to check if pages are enabled without NuxtPage being instantiated
      addPlugin(resolve(runtimeDir, 'plugins/check-if-page-unused'))
    }

    nuxt.hook('app:templates', async (app) => {
      app.pages = await resolvePagesRoutes()

      if (!nuxt.options.ssr && app.pages.some(p => p.mode === 'server')) {
        logger.warn('Using server pages with `ssr: false` is not supported with auto-detected component islands. Set `experimental.componentIslands` to `true`.')
      }
    })

    // Restart Nuxt when pages dir is added or removed
    const restartPaths = nuxt.options._layers.flatMap((layer) => {
      const pagesDir = (layer.config.rootDir === nuxt.options.rootDir ? nuxt.options : layer.config).dir?.pages || 'pages'
      return [
        resolve(layer.config.srcDir || layer.cwd, layer.config.dir?.app || 'app', 'router.options.ts'),
        resolve(layer.config.srcDir || layer.cwd, pagesDir),
      ]
    })

    nuxt.hooks.hook('builder:watch', async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (restartPaths.some(p => p === path || path.startsWith(p + '/'))) {
        const newSetting = await isPagesEnabled()
        if (nuxt.options.pages !== newSetting) {
          logger.info('Pages', newSetting ? 'enabled' : 'disabled')
          return nuxt.callHook('restart')
        }
      }
    })

    if (!nuxt.options.pages) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      addTemplate({
        filename: 'pages.mjs',
        getContents: () => [
          'export { useRoute } from \'#app/composables/router\'',
          'export const START_LOCATION = Symbol(\'router:start-location\')',
        ].join('\n'),
      })
      addTypeTemplate({
        filename: 'types/middleware.d.ts',
        getContents: () => [
          'declare module \'nitropack/types\' {',
          '  interface NitroRouteConfig {',
          '    appMiddleware?: string | string[] | Record<string, boolean>',
          '  }',
          '}',
          'declare module \'nitro/types\' {',
          '  interface NitroRouteConfig {',
          '    appMiddleware?: string | string[] | Record<string, boolean>',
          '  }',
          '}',
          'export {}',
        ].join('\n'),
      })
      addComponent({
        name: 'NuxtPage',
        priority: 10, // built-in that we do not expect the user to override
        filePath: resolve(distDir, 'pages/runtime/page-placeholder'),
      })
      // Prerender index if pages integration is not enabled
      nuxt.hook('nitro:init', (nitro) => {
        if (nuxt.options.dev || !nuxt.options.ssr || !nitro.options.static || !nitro.options.prerender.crawlLinks) { return }

        nitro.options.prerender.routes.push('/')
      })
      return
    }

    if (useExperimentalTypedPages) {
      const declarationFile = './types/typed-router.d.ts'

      const options: TypedRouterOptions = {
        routesFolder: [],
        dts: resolve(nuxt.options.buildDir, declarationFile),
        logs: nuxt.options.debug,
        async beforeWriteFiles (rootPage) {
          rootPage.children.forEach(child => child.delete())
          const pages = nuxt.apps.default?.pages || await resolvePagesRoutes()
          if (nuxt.apps.default) {
            nuxt.apps.default.pages = pages
          }
          const addedPagePaths = new Set<string>()
          function addPage (parent: EditableTreeNode, page: NuxtPage) {
            // Avoid duplicate keys in the generated RouteNamedMap type
            const absolutePagePath = joinURL(parent.path, page.path)

            // @ts-expect-error TODO: either fix types upstream or figure out another
            // way to add a route without a file, which must be possible
            const route = addedPagePaths.has(absolutePagePath) ? parent : parent.insert(page.path, page.file)
            addedPagePaths.add(absolutePagePath)
            if (page.meta) {
              route.addToMeta(page.meta)
            }
            if (page.alias) {
              route.addAlias(page.alias)
            }
            if (page.name) {
              route.name = page.name
            }
            // TODO: implement redirect support
            // if (page.redirect) {}
            if (page.children) {
              page.children.forEach(child => addPage(route, child))
            }
          }

          for (const page of pages) {
            addPage(rootPage, page)
          }
        },
      }

      nuxt.hook('prepare:types', ({ references }) => {
        // This file will be generated by unplugin-vue-router
        references.push({ path: declarationFile })
        references.push({ types: 'unplugin-vue-router/client' })
      })

      const context = createRoutesContext(resolveOptions(options))
      const dtsFile = resolve(nuxt.options.buildDir, declarationFile)
      await mkdir(dirname(dtsFile), { recursive: true })
      await context.scanPages(false)

      if (nuxt.options._prepare || !nuxt.options.dev) {
        // TODO: could we generate this from context instead?
        const dts = await readFile(dtsFile, 'utf-8')
        addTemplate({
          filename: 'types/typed-router.d.ts',
          getContents: () => dts,
        })
      }

      // Regenerate types/typed-router.d.ts when adding or removing pages
      nuxt.hook('app:templatesGenerated', async (_app, _templates, options) => {
        if (!options?.filter || options.filter({ filename: 'routes.mjs' } as any)) {
          await context.scanPages()
        }
      })
    }

    // Add $router types
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: useExperimentalTypedPages ? 'vue-router/auto-routes' : 'vue-router' })
    })

    // Add vue-router route guard imports
    nuxt.hook('imports:sources', (sources) => {
      const routerImports = sources.find(s => s.from === '#app/composables/router' && s.imports.includes('onBeforeRouteLeave'))
      if (routerImports) {
        routerImports.from = 'vue-router'
      }
    })

    // Regenerate templates when adding or removing pages
    const updateTemplatePaths = nuxt.options._layers.flatMap((l) => {
      const dir = (l.config.rootDir === nuxt.options.rootDir ? nuxt.options : l.config).dir
      return [
        resolve(l.config.srcDir || l.cwd, dir?.pages || 'pages') + '/',
        resolve(l.config.srcDir || l.cwd, dir?.layouts || 'layouts') + '/',
        resolve(l.config.srcDir || l.cwd, dir?.middleware || 'middleware') + '/',
      ]
    })

    function isPage (file: string, pages = nuxt.apps.default?.pages): boolean {
      if (!pages) { return false }
      return pages.some(page => page.file === file) || pages.some(page => page.children && isPage(file, page.children))
    }
    nuxt.hook('builder:watch', async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      const shouldAlwaysRegenerate = nuxt.options.experimental.scanPageMeta && isPage(path)

      if (event === 'change' && !shouldAlwaysRegenerate) { return }

      if (shouldAlwaysRegenerate || updateTemplatePaths.some(dir => path.startsWith(dir))) {
        await updateTemplates({
          filter: template => template.filename === 'routes.mjs',
        })
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
    })

    nuxt.hook('app:resolve', (app) => {
      const nitro = useNitro()
      if (nitro.options.prerender.crawlLinks || Object.values(nitro.options.routeRules).some(rule => rule.prerender)) {
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

    nuxt.hook('pages:extend', (pages) => {
      if (nuxt.options.dev) { return }

      prerenderRoutes.clear()
      processPages(pages)
    })

    nuxt.hook('nitro:build:before', (nitro) => {
      if (nuxt.options.dev || nuxt.options.router.options.hashMode) { return }

      // Inject page patterns that explicitly match `prerender: true` route rule
      if (!nitro.options.static && !nitro.options.prerender.crawlLinks) {
        const routeRulesMatcher = toRouteMatcher(createRadixRouter({ routes: nitro.options.routeRules }))
        for (const route of prerenderRoutes) {
          const rules = defu({} as Record<string, any>, ...routeRulesMatcher.matchAll(route).reverse())
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

    nuxt.hook('imports:extend', (imports) => {
      imports.push(
        { name: 'definePageMeta', as: 'definePageMeta', from: resolve(runtimeDir, 'composables') },
        { name: 'useLink', as: 'useLink', from: 'vue-router' },
      )
      if (nuxt.options.experimental.inlineRouteRules) {
        imports.push({ name: 'defineRouteRules', as: 'defineRouteRules', from: resolve(runtimeDir, 'composables') })
      }
    })

    if (nuxt.options.experimental.inlineRouteRules) {
      // Track mappings of absolute files to globs
      let pageToGlobMap = {} as { [absolutePath: string]: string | null }
      nuxt.hook('pages:extend', (pages) => { pageToGlobMap = getMappedPages(pages) })

      // Extracted route rules defined inline in pages
      const inlineRules = {} as { [glob: string]: NitroRouteConfig }

      // Allow telling Nitro to reload route rules
      let updateRouteConfig: () => void | Promise<void>
      nuxt.hook('nitro:init', (nitro) => {
        updateRouteConfig = () => nitro.updateConfig({ routeRules: defu(inlineRules, nitro.options._config.routeRules) })
      })

      const updatePage = async function updatePage (path: string) {
        const glob = pageToGlobMap[path]
        const code = path in nuxt.vfs ? nuxt.vfs[path]! : await readFile(path!, 'utf-8')
        try {
          const extractedRule = await extractRouteRules(code)
          if (extractedRule) {
            if (!glob) {
              const relativePath = relative(nuxt.options.srcDir, path)
              logger.error(`Could not set inline route rules in \`~/${relativePath}\` as it could not be mapped to a Nitro route.`)
              return
            }

            inlineRules[glob] = extractedRule
          } else if (glob) {
            delete inlineRules[glob]
          }
        } catch (e: any) {
          if (e.toString().includes('Error parsing route rules')) {
            const relativePath = relative(nuxt.options.srcDir, path)
            logger.error(`Error parsing route rules within \`~/${relativePath}\`. They should be JSON-serializable.`)
          } else {
            logger.error(e)
          }
        }
      }

      nuxt.hook('builder:watch', async (event, relativePath) => {
        const path = resolve(nuxt.options.srcDir, relativePath)
        if (!(path in pageToGlobMap)) { return }
        if (event === 'unlink') {
          delete inlineRules[path]
          delete pageToGlobMap[path]
        } else {
          await updatePage(path)
        }
        await updateRouteConfig?.()
      })

      nuxt.hooks.hookOnce('pages:extend', async () => {
        for (const page in pageToGlobMap) { await updatePage(page) }
        await updateRouteConfig?.()
      })
    }

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
    if (nuxt.options.experimental.appManifest) {
      // Add all redirect paths as valid routes to router; we will handle these in a client-side middleware
      // when the app manifest is enabled.
      nuxt.hook('pages:extend', (routes) => {
        const nitro = useNitro()
        let resolvedRoutes: string[]
        for (const [path, rule] of Object.entries(nitro.options.routeRules)) {
          if (!rule.redirect) { continue }
          resolvedRoutes ||= routes.flatMap(route => resolveRoutePaths(route))
          // skip if there's already a route matching this path
          if (resolvedRoutes.includes(path)) { continue }
          routes.push({
            _sync: true,
            path: path.replace(/\/[^/]*\*\*/, '/:pathMatch(.*)'),
            file: componentStubPath,
          })
        }
      })
    }

    // Extract macros from pages
    nuxt.hook('modules:done', () => {
      addBuildPlugin(PageMetaPlugin({
        dev: nuxt.options.dev,
        sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client,
      }))
    })

    // Add prefetching support for middleware & layouts
    addPlugin(resolve(runtimeDir, 'plugins/prefetch.client'))

    // Add build plugin to ensure template $route is kept in sync with `<NuxtPage>`
    if (nuxt.options.experimental.templateRouteInjection) {
      addBuildPlugin(RouteInjectionPlugin(nuxt), { server: false })
    }

    // Add router plugin
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

    const serverComponentRuntime = await findPath(join(distDir, 'components/runtime/server-component')) ?? join(distDir, 'components/runtime/server-component')
    const clientComponentRuntime = await findPath(join(distDir, 'components/runtime/client-component')) ?? join(distDir, 'components/runtime/client-component')

    // Add routes template
    addTemplate({
      filename: 'routes.mjs',
      getContents ({ app }) {
        if (!app.pages) { return 'export default []' }
        const { routes, imports } = normalizeRoutes(app.pages, new Set(), {
          serverComponentRuntime,
          clientComponentRuntime,
          overrideMeta: nuxt.options.experimental.scanPageMeta,
        })
        return [...imports, `export default ${routes}`].join('\n')
      },
    })

    // Add vue-router import for `<NuxtLayout>` integration
    addTemplate({
      filename: 'pages.mjs',
      getContents: () => 'export { START_LOCATION, useRoute } from \'vue-router\'',
    })

    nuxt.options.vite.resolve = nuxt.options.vite.resolve || {}
    nuxt.options.vite.resolve.dedupe = nuxt.options.vite.resolve.dedupe || []
    nuxt.options.vite.resolve.dedupe.push('vue-router')

    // Add router options template
    addTemplate({
      filename: 'router.options.mjs',
      getContents: async () => {
        // Scan and register app/router.options files
        const routerOptionsFiles = await resolveRouterOptions()

        const configRouterOptions = genObjectFromRawEntries(Object.entries(nuxt.options.router.options)
          .map(([key, value]) => [key, genString(value as string)]))

        return [
          ...routerOptionsFiles.map((file, index) => genImport(file.path, `routerOptions${index}`)),
          `const configRouterOptions = ${configRouterOptions}`,
          'export default {',
          '...configRouterOptions,',
          ...routerOptionsFiles.map((_, index) => `...routerOptions${index},`),
          '}',
        ].join('\n')
      },
    })

    addTypeTemplate({
      filename: 'types/middleware.d.ts',
      getContents: ({ nuxt, app }) => {
        const composablesFile = relative(join(nuxt.options.buildDir, 'types'), resolve(runtimeDir, 'composables'))
        const namedMiddleware = app.middleware.filter(mw => !mw.global)
        return [
          'import type { NavigationGuard } from \'vue-router\'',
          `export type MiddlewareKey = ${namedMiddleware.map(mw => genString(mw.name)).join(' | ') || 'never'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>',
          '  }',
          '}',
          'declare module \'nitropack/types\' {',
          '  interface NitroRouteConfig {',
          '    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>',
          '  }',
          '}',
          'declare module \'nitro/types\' {',
          '  interface NitroRouteConfig {',
          '    appMiddleware?: MiddlewareKey | MiddlewareKey[] | Record<MiddlewareKey, boolean>',
          '  }',
          '}',
        ].join('\n')
      },
    })

    addTypeTemplate({
      filename: 'types/layouts.d.ts',
      getContents: ({ nuxt, app }: { nuxt: Nuxt, app: NuxtApp }) => {
        const composablesFile = relative(join(nuxt.options.buildDir, 'types'), resolve(runtimeDir, 'composables'))
        return [
          'import type { ComputedRef, MaybeRef } from \'vue\'',
          `export type LayoutKey = ${Object.keys(app.layouts).map(name => genString(name)).join(' | ') || 'string'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>',
          '  }',
          '}',
        ].join('\n')
      },
    })

    // add page meta types if enabled
    if (nuxt.options.experimental.viewTransition) {
      addTypeTemplate({
        filename: 'types/view-transitions.d.ts',
        getContents: ({ nuxt }) => {
          const runtimeDir = resolve(distDir, 'pages/runtime')
          const composablesFile = relative(join(nuxt.options.buildDir, 'types'), resolve(runtimeDir, 'composables'))
          return [
            'import type { ComputedRef, MaybeRef } from \'vue\'',
            `declare module ${genString(composablesFile)} {`,
            '  interface PageMeta {',
            '    viewTransition?: boolean | \'always\'',
            '  }',
            '}',
          ].join('\n')
        },
      })
    }

    // Add <NuxtPage>
    addComponent({
      name: 'NuxtPage',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(distDir, 'pages/runtime/page'),
    })
  },
})
