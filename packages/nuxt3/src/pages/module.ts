import { existsSync } from 'fs'
import { defineNuxtModule, addTemplate, addPlugin, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import { resolve } from 'pathe'
import { genDynamicImport, genString, genArrayFromRaw, genImport, genObjectFromRawEntries } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { distDir } from '../dirs'
import { resolveLayouts, resolvePagesRoutes, normalizeRoutes, resolveMiddleware, getImportName } from './utils'
import { TransformMacroPlugin, TransformMacroPluginOptions } from './macros'

export default defineNuxtModule({
  meta: {
    name: 'router'
  },
  setup (_options, nuxt) {
    const pagesDir = resolve(nuxt.options.srcDir, nuxt.options.dir.pages)
    const runtimeDir = resolve(distDir, 'pages/runtime')

    // Disable module (and use universal router) if pages dir do not exists
    if (!existsSync(pagesDir)) {
      addPlugin(resolve(distDir, 'app/plugins/router'))
      return
    }

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

      const pathPattern = new RegExp(`^(${dirs.map(escapeRE).join('|')})/`)
      if (event !== 'change' && path.match(pathPattern)) {
        await nuxt.callHook('builder:generateApp')
      }
    })

    nuxt.hook('app:resolve', (app) => {
      // Add default layout for pages
      if (app.mainComponent.includes('nuxt-welcome')) {
        app.mainComponent = resolve(runtimeDir, 'app.vue')
      }
    })

    nuxt.hook('autoImports:extend', (autoImports) => {
      autoImports.push({ name: 'definePageMeta', as: 'definePageMeta', from: resolve(runtimeDir, 'composables') })
    })

    // Extract macros from pages
    const macroOptions: TransformMacroPluginOptions = {
      dev: nuxt.options.dev,
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
        const pages = await resolvePagesRoutes(nuxt)
        await nuxt.callHook('pages:extend', pages)
        const { routes, imports } = normalizeRoutes(pages)
        return [...imports, `export default ${routes}`].join('\n')
      }
    })

    // Add middleware template
    addTemplate({
      filename: 'middleware.mjs',
      async getContents () {
        const middleware = await resolveMiddleware()
        const globalMiddleware = middleware.filter(mw => mw.global)
        const namedMiddleware = middleware.filter(mw => !mw.global)
        const namedMiddlewareObject = genObjectFromRawEntries(namedMiddleware.map(mw => [mw.name, genDynamicImport(mw.path)]))
        return [
          ...globalMiddleware.map(mw => genImport(mw.path, getImportName(mw.name))),
          `export const globalMiddleware = ${genArrayFromRaw(globalMiddleware.map(mw => getImportName(mw.name)))}`,
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
      getContents: async () => {
        const composablesFile = resolve(runtimeDir, 'composables')
        const layouts = await resolveLayouts(nuxt)
        return [
          'import { ComputedRef, Ref } from \'vue\'',
          `export type LayoutKey = ${layouts.map(layout => genString(layout.name)).join(' | ') || 'string'}`,
          `declare module ${genString(composablesFile)} {`,
          '  interface PageMeta {',
          '    layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey>',
          '  }',
          '}'
        ].join('\n')
      }
    })

    // Add layouts template
    addTemplate({
      filename: 'layouts.mjs',
      async getContents () {
        const layouts = await resolveLayouts(nuxt)
        const layoutsObject = genObjectFromRawEntries(layouts.map(({ name, file }) => {
          return [name, `defineAsyncComponent({ suspensible: false, loader: ${genDynamicImport(file)} })`]
        }))
        return [
          'import { defineAsyncComponent } from \'vue\'',
          `export default ${layoutsObject}`
        ].join('\n')
      }
    })

    // Add declarations for middleware and layout keys
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'types/layouts.d.ts') })
    })
  }
})
