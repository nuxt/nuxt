import { existsSync } from 'fs'
import { defineNuxtModule, addTemplate, addPlugin, templateUtils, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import { resolve } from 'pathe'
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

    // Disable module if pages dir do not exists
    if (!existsSync(pagesDir)) {
      return
    }

    // Add $router types
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ types: 'vue-router' })
    })

    // Regenerate templates when adding or removing pages
    nuxt.hook('builder:watch', async (event, path) => {
      const pathPattern = new RegExp(`^(${nuxt.options.dir.pages}|${nuxt.options.dir.layouts})/`)
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
      const composablesFile = resolve(runtimeDir, 'composables')
      const composables = [
        'useRouter',
        'useRoute',
        'defineNuxtRouteMiddleware',
        'definePageMeta',
        'navigateTo',
        'abortNavigation',
        'addRouteMiddleware'
      ]
      for (const composable of composables) {
        autoImports.push({ name: composable, as: composable, from: composablesFile })
      }
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
        const { routes: serializedRoutes, imports } = normalizeRoutes(pages)
        return [...imports, `export default ${templateUtils.serialize(serializedRoutes)}`].join('\n')
      }
    })

    // Add middleware template
    addTemplate({
      filename: 'middleware.mjs',
      async getContents () {
        const middleware = await resolveMiddleware()
        await nuxt.callHook('pages:middleware:extend', middleware)
        const middlewareObject = Object.fromEntries(middleware.map(mw => [mw.name, `{() => import('${mw.path}')}`]))
        const globalMiddleware = middleware.filter(mw => mw.global)
        return [
          ...globalMiddleware.map(mw => `import ${getImportName(mw.name)} from '${mw.path}'`),
          `export const globalMiddleware = [${globalMiddleware.map(mw => getImportName(mw.name)).join(', ')}]`,
          `export const namedMiddleware = ${templateUtils.serialize(middlewareObject)}`
        ].join('\n')
      }
    })

    addTemplate({
      filename: 'middleware.d.ts',
      write: true,
      getContents: async () => {
        const composablesFile = resolve(runtimeDir, 'composables')
        const middleware = await resolveMiddleware()
        return [
          'import type { NavigationGuard } from \'vue-router\'',
          `export type MiddlewareKey = ${middleware.map(mw => `"${mw.name}"`).join(' | ') || 'string'}`,
          `declare module '${composablesFile}' {`,
          '  interface PageMeta {',
          '    middleware?: MiddlewareKey | NavigationGuard | Array<MiddlewareKey | NavigationGuard>',
          '  }',
          '}'
        ].join('\n')
      }
    })

    addTemplate({
      filename: 'layouts.d.ts',
      write: true,
      getContents: async () => {
        const composablesFile = resolve(runtimeDir, 'composables')
        const layouts = await resolveLayouts(nuxt)
        return [
          'import { ComputedRef, Ref } from \'vue\'',
          `export type LayoutKey = ${layouts.map(layout => `"${layout.name}"`).join(' | ') || 'string'}`,
          `declare module '${composablesFile}' {`,
          '  interface PageMeta {',
          '    layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey>',
          '  }',
          '}'
        ].join('\n')
      }
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'layouts.d.ts') })
    })

    // Add layouts template
    addTemplate({
      filename: 'layouts.mjs',
      async getContents () {
        const layouts = await resolveLayouts(nuxt)
        const layoutsObject = Object.fromEntries(layouts.map(({ name, file }) => {
          return [name, `{defineAsyncComponent({ suspensible: false, loader: () => import('${file}') })}`]
        }))
        return [
          'import { defineAsyncComponent } from \'vue\'',
          `export default ${templateUtils.serialize(layoutsObject)}`
        ].join('\n')
      }
    })
  }
})
