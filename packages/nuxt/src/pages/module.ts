import { existsSync, readdirSync } from 'node:fs'
import { defineNuxtModule, addTemplate, addPlugin, addVitePlugin, addWebpackPlugin, findPath, addComponent, updateTemplates } from '@nuxt/kit'
import { relative, resolve } from 'pathe'
import { genString, genImport, genObjectFromRawEntries } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { joinURL } from 'ufo'
import { distDir } from '../dirs'
import { resolvePagesRoutes, normalizeRoutes } from './utils'
import type { PageMetaPluginOptions } from './page-meta'
import { PageMetaPlugin } from './page-meta'
import type { NuxtApp, NuxtPage } from 'nuxt/schema'

export default defineNuxtModule({
  meta: {
    name: 'pages'
  },
  setup (_options, nuxt) {
    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    )

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    const isNonEmptyDir = (dir: string) => existsSync(dir) && readdirSync(dir).length
    const isPagesEnabled = () => {
      if (typeof nuxt.options.pages === 'boolean') {
        return nuxt.options.pages
      }
      if (nuxt.options._layers.some(layer => existsSync(resolve(layer.config.srcDir, 'app/router.options.ts')))) {
        return true
      }
      if (pagesDirs.some(dir => isNonEmptyDir(dir))) {
        return true
      }
      return false
    }
    nuxt.options.pages = isPagesEnabled()

    if (!nuxt.options.pages) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      addTemplate({
        filename: 'pages.mjs',
        getContents: () => 'export { useRoute } from \'#app\''
      })
      addComponent({
        name: 'NuxtPage',
        filePath: resolve(distDir, 'pages/runtime/page-placeholder')
      })
      return
    }

    const runtimeDir = resolve(distDir, 'pages/runtime')

    // Add $router types
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: 'vue-router' })
    })

    // Add vue-router route guard imports
    nuxt.hook('imports:sources', (sources) => {
      const routerImports = sources.find(s => s.from === '#app' && s.imports.includes('onBeforeRouteLeave'))
      if (routerImports) {
        routerImports.from = 'vue-router'
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
      if (event !== 'change' && path.match(pathPattern)) {
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

    // Prerender all non-dynamic page routes when generating app
    if (!nuxt.options.dev && nuxt.options._generate) {
      const prerenderRoutes = new Set<string>()
      nuxt.hook('modules:done', () => {
        nuxt.hook('pages:extend', (pages) => {
          prerenderRoutes.clear()
          const processPages = (pages: NuxtPage[], currentPath = '/') => {
            for (const page of pages) {
              // Add root of optional dynamic paths and catchalls
              if (page.path.match(/^\/?:.*(\?|\(\.\*\)\*)$/) && !page.children?.length) { prerenderRoutes.add(currentPath) }
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
    }

    nuxt.hook('imports:extend', (imports) => {
      imports.push(
        { name: 'definePageMeta', as: 'definePageMeta', from: resolve(runtimeDir, 'composables') },
        { name: 'useLink', as: 'useLink', from: 'vue-router' }
      )
    })

    // Extract macros from pages
    const pageMetaOptions: PageMetaPluginOptions = {
      dev: nuxt.options.dev,
      sourcemap: nuxt.options.sourcemap.server || nuxt.options.sourcemap.client,
      dirs: nuxt.options._layers.map(
        layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
      )
    }
    addVitePlugin(PageMetaPlugin.vite(pageMetaOptions))
    addWebpackPlugin(PageMetaPlugin.webpack(pageMetaOptions))

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
      filePath: resolve(distDir, 'pages/runtime/page')
    })

    // Add declarations for middleware keys
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'types/layouts.d.ts') })
    })
  }
})
