import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { addBuildPlugin, addComponent, addPlugin, addTemplate, addVitePlugin, addWebpackPlugin, defineNuxtModule, findPath, updateTemplates } from '@nuxt/kit'
import { dirname, join, relative, resolve } from 'pathe'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import { joinURL } from 'ufo'
import type { Nuxt, NuxtApp, NuxtPage } from 'nuxt/schema'
import { createRoutesContext } from 'unplugin-vue-router'
import { resolveOptions } from 'unplugin-vue-router/options'
import type { EditableTreeNode, Options as TypedRouterOptions } from 'unplugin-vue-router'

import type { NitroRouteConfig } from 'nitropack'
import { defu } from 'defu'
import { distDir } from '../dirs'
import { normalizeRoutes, resolvePagesRoutes } from './utils'
import { extractRouteRules, getMappedPages } from './route-rules'
import type { PageMetaPluginOptions } from './plugins/page-meta'
import { PageMetaPlugin } from './plugins/page-meta'
import { RouteInjectionPlugin } from './plugins/route-injection'

const OPTIONAL_PARAM_RE = /^\/?:.*(\?|\(\.\*\)\*)$/

export default defineNuxtModule({
  meta: {
    name: 'pages'
  },
  async setup (_options, nuxt) {
    const useExperimentalTypedPages = nuxt.options.experimental.typedPages

    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    )

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    const isNonEmptyDir = (dir: string) => existsSync(dir) && readdirSync(dir).length
    const userPreference = nuxt.options.pages
    const isPagesEnabled = async () => {
      if (typeof userPreference === 'boolean') {
        return userPreference
      }
      if (nuxt.options._layers.some(layer => existsSync(resolve(layer.config.srcDir, 'app/router.options.ts')))) {
        return true
      }
      if (pagesDirs.some(dir => isNonEmptyDir(dir))) {
        return true
      }

      const pages = await resolvePagesRoutes()
      await nuxt.callHook('pages:extend', pages)
      if (pages.length) { return true }

      return false
    }
    nuxt.options.pages = await isPagesEnabled()

    // Restart Nuxt when pages dir is added or removed
    const restartPaths = nuxt.options._layers.flatMap(layer => [
      join(layer.config.srcDir || layer.cwd, 'app/router.options.ts'),
      join(layer.config.srcDir || layer.cwd, layer.config.dir?.pages || 'pages')
    ])

    nuxt.hooks.hook('builder:watch', async (event, relativePath) => {
      const path = resolve(nuxt.options.srcDir, relativePath)
      if (restartPaths.some(p => p === path || path.startsWith(p + '/'))) {
        const newSetting = await isPagesEnabled()
        if (nuxt.options.pages !== newSetting) {
          console.info('Pages', newSetting ? 'enabled' : 'disabled')
          return nuxt.callHook('restart')
        }
      }
    })

    // adds support for #vue-router alias (used for types) with and without pages integration
    addTemplate({
      filename: 'vue-router.d.ts',
      getContents: () => `export * from '${useExperimentalTypedPages ? 'vue-router/auto' : 'vue-router'}'`
    })

    nuxt.options.alias['#vue-router'] = join(nuxt.options.buildDir, 'vue-router')

    if (!nuxt.options.pages) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      addTemplate({
        filename: 'pages.mjs',
        getContents: () => 'export { useRoute } from \'#app\''
      })
      addComponent({
        name: 'NuxtPage',
        priority: 10, // built-in that we do not expect the user to override
        filePath: resolve(distDir, 'pages/runtime/page-placeholder')
      })
      return
    }

    addTemplate({
      filename: 'vue-router.mjs',
      // TODO: use `vue-router/auto` when we have support for page metadata
      getContents: () => 'export * from \'vue-router\';'
    })

    if (useExperimentalTypedPages) {
      const declarationFile = './types/typed-router.d.ts'

      const options: TypedRouterOptions = {
        routesFolder: [],
        dts: resolve(nuxt.options.buildDir, declarationFile),
        logs: nuxt.options.debug,
        async beforeWriteFiles (rootPage) {
          rootPage.children.forEach(child => child.delete())
          const pages = await resolvePagesRoutes()
          await nuxt.callHook('pages:extend', pages)
          function addPage (parent: EditableTreeNode, page: NuxtPage) {
            // @ts-expect-error TODO: either fix types upstream or figure out another
            // way to add a route without a file, which must be possible
            const route = parent.insert(page.path, page.file)
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
        }
      }

      nuxt.hook('prepare:types', ({ references }) => {
        // This file will be generated by unplugin-vue-router
        references.push({ path: declarationFile })
      })

      const context = createRoutesContext(resolveOptions(options))
      const dtsFile = resolve(nuxt.options.buildDir, declarationFile)
      await mkdir(dirname(dtsFile), { recursive: true })
      await context.scanPages(false)

      if (nuxt.options._prepare) {
        // TODO: could we generate this from context instead?
        const dts = await readFile(dtsFile, 'utf-8')
        addTemplate({
          filename: 'types/typed-router.d.ts',
          getContents: () => dts
        })
      }

      // Regenerate types/typed-router.d.ts when adding or removing pages
      nuxt.hook('builder:generateApp', async (options) => {
        if (!options?.filter || options.filter({ filename: 'routes.mjs' } as any)) {
          await context.scanPages()
        }
      })
    }

    const runtimeDir = resolve(distDir, 'pages/runtime')

    // Add $router types
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: useExperimentalTypedPages ? 'vue-router/auto' : 'vue-router' })
    })

    // Add vue-router route guard imports
    nuxt.hook('imports:sources', (sources) => {
      const routerImports = sources.find(s => s.from === '#app' && s.imports.includes('onBeforeRouteLeave'))
      if (routerImports) {
        routerImports.from = '#vue-router'
      }
    })

    // Regenerate templates when adding or removing pages
    const updateTemplatePaths = nuxt.options._layers.flatMap(l => [
      join(l.config.srcDir || l.cwd, l.config.dir?.pages || 'pages') + '/',
      join(l.config.srcDir || l.cwd, l.config.dir?.layouts || 'layouts') + '/',
      join(l.config.srcDir || l.cwd, l.config.dir?.middleware || 'middleware') + '/'
    ])

    nuxt.hook('builder:watch', async (event, relativePath) => {
      if (event === 'change') { return }

      const path = resolve(nuxt.options.srcDir, relativePath)
      if (updateTemplatePaths.some(dir => path.startsWith(dir))) {
        await updateTemplates({
          filter: template => template.filename === 'routes.mjs'
        })
      }
    })

    nuxt.hook('app:resolve', (app) => {
      // Add default layout for pages
      if (app.mainComponent!.includes('@nuxt/ui-templates')) {
        app.mainComponent = resolve(runtimeDir, 'app.vue')
      }
      app.middleware.unshift({
        name: 'validate',
        path: resolve(runtimeDir, 'validate'),
        global: true
      })
    })

    nuxt.hook('nitro:init', (nitro) => {
      if (nuxt.options.dev || !nitro.options.static) { return }
      // Prerender all non-dynamic page routes when generating app
      const prerenderRoutes = new Set<string>()
      nuxt.hook('pages:extend', (pages) => {
        prerenderRoutes.clear()
        const processPages = (pages: NuxtPage[], currentPath = '/') => {
          for (const page of pages) {
            // Add root of optional dynamic paths and catchalls
            if (OPTIONAL_PARAM_RE.test(page.path) && !page.children?.length) { prerenderRoutes.add(currentPath) }
            // Skip dynamic paths
            if (page.path.includes(':')) { continue }
            const route = joinURL(currentPath, page.path)
            prerenderRoutes.add(route)
            if (page.children) { processPages(page.children, route) }
          }
        }
        processPages(pages)
      })
      nuxt.hook('nitro:build:before', (nitro) => {
        for (const route of nitro.options.prerender.routes || []) {
          // Skip default route value as we only generate it if it is already
          // in the detected routes from `~/pages`.
          if (route === '/') { continue }
          prerenderRoutes.add(route)
        }
        nitro.options.prerender.routes = Array.from(prerenderRoutes)
      })
    })

    nuxt.hook('imports:extend', (imports) => {
      imports.push(
        { name: 'definePageMeta', as: 'definePageMeta', from: resolve(runtimeDir, 'composables') },
        { name: 'useLink', as: 'useLink', from: '#vue-router' }
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

      async function updatePage (path: string) {
        const glob = pageToGlobMap[path]
        const code = path in nuxt.vfs ? nuxt.vfs[path] : await readFile(path!, 'utf-8')
        try {
          const extractedRule = await extractRouteRules(code)
          if (extractedRule) {
            if (!glob) {
              const relativePath = relative(nuxt.options.srcDir, path)
              console.error(`[nuxt] Could not set inline route rules in \`~/${relativePath}\` as it could not be mapped to a Nitro route.`)
              return
            }

            inlineRules[glob] = extractedRule
          } else if (glob) {
            delete inlineRules[glob]
          }
        } catch (e: any) {
          if (e.toString().includes('Error parsing route rules')) {
            const relativePath = relative(nuxt.options.srcDir, path)
            console.error(`[nuxt] Error parsing route rules within \`~/${relativePath}\`. They should be JSON-serializable.`)
          } else {
            console.error(e)
          }
        }
      }

      nuxt.hook('builder:watch', async (event, relativePath) => {
        const path = join(nuxt.options.srcDir, relativePath)
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

    // Extract macros from pages
    const pageMetaOptions: PageMetaPluginOptions = {
      dev: nuxt.options.dev,
      sourcemap: !!nuxt.options.sourcemap.server || !!nuxt.options.sourcemap.client
    }
    nuxt.hook('modules:done', () => {
      addVitePlugin(() => PageMetaPlugin.vite(pageMetaOptions))
      addWebpackPlugin(() => PageMetaPlugin.webpack(pageMetaOptions))
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
        [relative(nuxt.options.srcDir, p.file as string), ...getSources(p.children || [])]
      )

    // Do not prefetch page chunks
    nuxt.hook('build:manifest', async (manifest) => {
      if (nuxt.options.dev) { return }
      const pages = await resolvePagesRoutes()
      await nuxt.callHook('pages:extend', pages)

      const sourceFiles = getSources(pages)

      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports =
            manifest[key].dynamicImports?.filter(i => !sourceFiles.includes(i))
        }
      }
    })

    // Add routes template
    addTemplate({
      filename: 'routes.mjs',
      async getContents () {
        const pages = await resolvePagesRoutes()
        await nuxt.callHook('pages:extend', pages)
        const { routes, imports } = normalizeRoutes(pages)
        return [...imports, `export default ${routes}`].join('\n')
      }
    })

    // Add vue-router import for `<NuxtLayout>` integration
    addTemplate({
      filename: 'pages.mjs',
      getContents: () => 'export { useRoute } from \'vue-router\''
    })

    // Optimize vue-router to ensure we share the same injection symbol
    nuxt.options.vite.optimizeDeps = nuxt.options.vite.optimizeDeps || {}
    nuxt.options.vite.optimizeDeps.include = nuxt.options.vite.optimizeDeps.include || []
    nuxt.options.vite.optimizeDeps.include.push('vue-router')

    nuxt.options.vite.resolve = nuxt.options.vite.resolve || {}
    nuxt.options.vite.resolve.dedupe = nuxt.options.vite.resolve.dedupe || []
    nuxt.options.vite.resolve.dedupe.push('vue-router')

    // Add router options template
    addTemplate({
      filename: 'router.options.mjs',
      getContents: async () => {
        // Scan and register app/router.options files
        const routerOptionsFiles = (await Promise.all(nuxt.options._layers.map(
          async layer => await findPath(resolve(layer.config.srcDir, 'app/router.options'))
        ))).filter(Boolean) as string[]

        // Add default options
        routerOptionsFiles.push(resolve(runtimeDir, 'router.options'))

        const configRouterOptions = genObjectFromRawEntries(Object.entries(nuxt.options.router.options)
          .map(([key, value]) => [key, genString(value as string)]))

        return [
          ...routerOptionsFiles.map((file, index) => genImport(file, `routerOptions${index}`)),
          `const configRouterOptions = ${configRouterOptions}`,
          'export default {',
          '...configRouterOptions,',
          // We need to reverse spreading order to respect layers priority
          ...routerOptionsFiles.map((_, index) => `...routerOptions${index},`).reverse(),
          '}'
        ].join('\n')
      }
    })

    addTemplate({
      filename: 'types/middleware.d.ts',
      getContents: ({ nuxt, app }: { nuxt: Nuxt, app: NuxtApp }) => {
        const composablesFile = relative(join(nuxt.options.buildDir, 'types'), resolve(runtimeDir, 'composables'))
        const namedMiddleware = app.middleware.filter(mw => !mw.global)
        return [
          'import type { NavigationGuard } from \'vue-router\'',
          `export type MiddlewareKey = ${namedMiddleware.map(mw => genString(mw.name)).join(' | ') || 'string'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>',
          '  }',
          '}'
        ].join('\n')
      }
    })

    addTemplate({
      filename: 'types/layouts.d.ts',
      getContents: ({ nuxt, app }: { nuxt: Nuxt, app: NuxtApp }) => {
        const composablesFile = relative(join(nuxt.options.buildDir, 'types'), resolve(runtimeDir, 'composables'))
        return [
          'import { ComputedRef, MaybeRef } from \'vue\'',
          `export type LayoutKey = ${Object.keys(app.layouts).map(name => genString(name)).join(' | ') || 'string'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    layout?: MaybeRef<LayoutKey | false> | ComputedRef<LayoutKey | false>',
          '  }',
          '}'
        ].join('\n')
      }
    })

    // Add <NuxtPage>
    addComponent({
      name: 'NuxtPage',
      priority: 10, // built-in that we do not expect the user to override
      filePath: resolve(distDir, 'pages/runtime/page')
    })

    // Add declarations for middleware keys
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'types/layouts.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'vue-router.d.ts') })
    })
  }
})
