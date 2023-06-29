import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { addComponent, addPlugin, addTemplate, addVitePlugin, addWebpackPlugin, defineNuxtModule, findPath, updateTemplates } from '@nuxt/kit'
import { dirname, join, relative, resolve } from 'pathe'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { joinURL } from 'ufo'
import type { NuxtApp, NuxtPage } from 'nuxt/schema'
import { createRoutesContext } from 'unplugin-vue-router'
import { resolveOptions } from 'unplugin-vue-router/options'
import type { EditableTreeNode, Options as TypedRouterOptions } from 'unplugin-vue-router'

import { distDir } from '../dirs'
import { normalizeRoutes, resolvePagesRoutes } from './utils'
import type { PageMetaPluginOptions } from './page-meta'
import { PageMetaPlugin } from './page-meta'

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
      join(layer.config.srcDir, 'app/router.options.ts'),
      join(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    ])
    nuxt.hooks.hook('builder:watch', async (event, path) => {
      const fullPath = join(nuxt.options.srcDir, path)
      if (restartPaths.some(path => path === fullPath || fullPath.startsWith(path + '/'))) {
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
    nuxt.hook('builder:watch', async (event, path) => {
      const dirs = [
        nuxt.options.dir.pages,
        nuxt.options.dir.layouts,
        nuxt.options.dir.middleware
      ].filter(Boolean)

      const pathPattern = new RegExp(`(^|\\/)(${dirs.map(escapeRE).join('|')})/`)
      if (event !== 'change' && pathPattern.test(path)) {
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
      nuxt.hook('modules:done', () => {
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
    })

    // Extract macros from pages
    const pageMetaOptions: PageMetaPluginOptions = {
      dev: nuxt.options.dev,
      sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client
    }
    nuxt.hook('modules:done', () => {
      addVitePlugin(() => PageMetaPlugin.vite(pageMetaOptions))
      addWebpackPlugin(() => PageMetaPlugin.webpack(pageMetaOptions))
    })

    // Add prefetching support for middleware & layouts
    addPlugin(resolve(runtimeDir, 'plugins/prefetch.client'))

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
      getContents: ({ app }: { app: NuxtApp }) => {
        const composablesFile = resolve(runtimeDir, 'composables')
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
      getContents: ({ app }: { app: NuxtApp }) => {
        const composablesFile = resolve(runtimeDir, 'composables')
        return [
          'import { ComputedRef, Ref } from \'vue\'',
          `export type LayoutKey = ${Object.keys(app.layouts).map(name => genString(name)).join(' | ') || 'string'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey>',
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
