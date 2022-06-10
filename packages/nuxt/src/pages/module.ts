import { existsSync } from 'node:fs'
import { defineNuxtModule, addTemplate, addPlugin, addVitePlugin, addWebpackPlugin, findPath } from '@nuxt/kit'
import { resolve } from 'pathe'
import { genDynamicImport, genString, genArrayFromRaw, genImport, genObjectFromRawEntries, genSafeVariableName } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { distDir } from '../dirs'
import { resolvePagesRoutes, normalizeRoutes, resolveMiddleware } from './utils'
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
        nuxt.options.dir.middleware
      ].filter(Boolean)

      const pathPattern = new RegExp(`(^|\\/)(${dirs.map(escapeRE).join('|')})/`)
      if (event !== 'change' && path.match(pathPattern)) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    nuxt.hook('app:resolve', (app) => {
      // Add default layout for pages
      if (app.mainComponent.includes('@nuxt/ui-templates')) {
        app.mainComponent = resolve(runtimeDir, 'app.vue')
      }
    })

    nuxt.hook('autoImports:extend', (autoImports) => {
      autoImports.push({ name: 'definePageMeta', as: 'definePageMeta', from: resolve(runtimeDir, 'composables') })
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
        ))).filter(Boolean)

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

    // Add middleware template
    addTemplate({
      filename: 'middleware.mjs',
      async getContents () {
        const middleware = await resolveMiddleware()
        await nuxt.callHook('pages:middleware:extend', middleware)
        const globalMiddleware = middleware.filter(mw => mw.global)
        const namedMiddleware = middleware.filter(mw => !mw.global)
        const namedMiddlewareObject = genObjectFromRawEntries(namedMiddleware.map(mw => [mw.name, genDynamicImport(mw.path)]))
        return [
          ...globalMiddleware.map(mw => genImport(mw.path, genSafeVariableName(mw.name))),
          `export const globalMiddleware = ${genArrayFromRaw(globalMiddleware.map(mw => genSafeVariableName(mw.name)))}`,
          `export const namedMiddleware = ${namedMiddlewareObject}`
        ].join('\n')
      }
    })

    addTemplate({
      filename: 'types/middleware.d.ts',
      getContents: async () => {
        const composablesFile = resolve(runtimeDir, 'composables')
        const middleware = await resolveMiddleware()
        const namedMiddleware = middleware.filter(mw => !mw.global)
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
      getContents: ({ app }) => {
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
