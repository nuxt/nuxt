import { existsSync } from 'node:fs'
import { defineNuxtModule, addTemplate, addPlugin, addVitePlugin, addWebpackPlugin, findPath } from '@nuxt/kit'
import { relative, resolve } from 'pathe'
import { genString, genImport, genObjectFromRawEntries } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import type { NuxtApp, NuxtPage } from '@nuxt/schema'
import { joinURL } from 'ufo'
import { distDir } from '../dirs'
import { resolvePagesRoutes, normalizeRoutes } from './utils'
import { TransformMacroPlugin, TransformMacroPluginOptions } from './macros'

export default defineNuxtModule({
  meta: {
    name: 'pages'
  },
  setup (_options, nuxt) {
    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    )

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    if (nuxt.options.pages === false || (nuxt.options.pages !== true && !pagesDirs.some(dir => existsSync(dir)))) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      return
    }

    const runtimeDir = resolve(distDir, 'pages/runtime')

    // Add $router types
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: 'vue-router' })
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
        await nuxt.callHook('builder:generateApp')
      }
    })

    nuxt.hook('app:resolve', (app) => {
      // Add default layout for pages
      if (app.mainComponent!.includes('@nuxt/ui-templates')) {
        app.mainComponent = resolve(runtimeDir, 'app.vue')
      }
    })

    // Prerender all non-dynamic page routes when generating app
    if (!nuxt.options.dev && nuxt.options._generate) {
      const prerenderRoutes = new Set<string>()
      nuxt.hook('modules:done', () => {
        nuxt.hook('pages:extend', (pages) => {
          prerenderRoutes.clear()
          const processPages = (pages: NuxtPage[], currentPath = '/') => {
            for (const page of pages) {
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
    const macroOptions: TransformMacroPluginOptions = {
      dev: nuxt.options.dev,
      sourcemap: nuxt.options.sourcemap,
      macros: {
        definePageMeta: 'meta'
      }
    }
    addVitePlugin(TransformMacroPlugin.vite(macroOptions))
    addWebpackPlugin(TransformMacroPlugin.webpack(macroOptions))

    // Add router plugin
    addPlugin(resolve(runtimeDir, 'router'))

    const getSources = (pages: NuxtPage[]): string[] => pages.flatMap(p =>
      [relative(nuxt.options.srcDir, p.file), ...getSources(p.children || [])]
    )

    // Do not prefetch page chunks
    nuxt.hook('build:manifest', async (manifest) => {
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

    // Add router options template
    addTemplate({
      filename: 'router.options.mjs',
      getContents: async () => {
        // Check for router options
        const routerOptionsFiles = (await Promise.all(nuxt.options._layers.map(
          async layer => await findPath(resolve(layer.config.srcDir, 'app/router.options'))
        ))).filter(Boolean) as string[]

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

    // Add declarations for middleware keys
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'types/layouts.d.ts') })
    })
  }
})
