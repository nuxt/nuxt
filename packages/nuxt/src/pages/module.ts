import { existsSync, readdirSync } from 'node:fs'
import { addComponent, addPlugin, addTemplate, addVitePlugin, addWebpackPlugin, defineNuxtModule, findPath, updateTemplates } from '@nuxt/kit'
import { join, relative, resolve } from 'pathe'
import { genImport, genObjectFromRawEntries, genString } from 'knitwork'
import escapeRE from 'escape-string-regexp'
import { joinURL } from 'ufo'
import type { NuxtApp, NuxtPage } from 'nuxt/schema'
import VueRouterVite from 'unplugin-vue-router/vite'
import VueRouterWebpack from 'unplugin-vue-router/webpack'
import { createRoutesContext } from 'unplugin-vue-router'
// @ts-expect-error TODO: expose subpath using named exports
import { resolveOptions } from 'unplugin-vue-router/options'
import type { EditableTreeNode, Options as _UVROptions } from 'unplugin-vue-router'

import { distDir } from '../dirs'
import { normalizeRoutes, resolvePagesRoutes } from './utils'
import type { PageMetaPluginOptions } from './page-meta'
import { PageMetaPlugin } from './page-meta'

export default defineNuxtModule({
  meta: {
    name: 'pages'
  },
  async setup (_options, nuxt) {
    const useExperimentalTypedPages = nuxt.options.experimental.typedPages
    const vueRouterPath = useExperimentalTypedPages ? 'vue-router/auto' : 'vue-router'

    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    )

    // Disable module (and use universal router) if pages dir do not exists or user has disabled it
    const isNonEmptyDir = (dir: string) => existsSync(dir) && readdirSync(dir).length
    const userPreference = nuxt.options.pages
    const isPagesEnabled = () => {
      if (typeof userPreference === 'boolean') {
        return userPreference
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

    // Restart Nuxt when pages dir is added or removed
    const restartPaths = nuxt.options._layers.flatMap(layer => [
      join(layer.config.srcDir, 'app/router.options.ts'),
      join(layer.config.srcDir, layer.config.dir?.pages || 'pages')
    ])
    nuxt.hooks.hook('builder:watch', (event, path) => {
      const fullPath = join(nuxt.options.srcDir, path)
      if (restartPaths.some(path => path === fullPath || fullPath.startsWith(path + '/'))) {
        const newSetting = isPagesEnabled()
        if (nuxt.options.pages !== newSetting) {
          console.info('Pages', newSetting ? 'enabled' : 'disabled')
          return nuxt.callHook('restart')
        }
      }
    })

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

    let rootPage: EditableTreeNode | undefined
    if (useExperimentalTypedPages) {
      console.log('📄 Adding pages module')
      const options: _UVROptions = {
        routesFolder: pagesDirs,
        dts: resolve(nuxt.options.buildDir, 'types/typed-router.d.ts'),
        logs: true,
        extendRoute (route) {
          // TODO: refactor names and types conditionally
          return nuxt.callHook('pages:extendOne', route)
        },
        async beforeWriteFiles (_rootPage) {
          await nuxt.callHook('pages:beforeWrite', _rootPage)
          await nuxt.callHook('pages:extend', [..._rootPage])
          rootPage = _rootPage
        }
      }

      nuxt.hook('prepare:types', ({ references }) => {
        references.push({ path: './types/typed-router.d.ts' })
      })

      if (nuxt.options._prepare) {
        await createRoutesContext(resolveOptions(options)).scanPages(false)
      }

      addVitePlugin(VueRouterVite(options), { prepend: true })
      // @ts-expect-error TODO: https://github.com/nuxt/nuxt/pull/20403
      addWebpackPlugin(VueRouterWebpack(options), { prepend: true })
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
        routerImports.from = vueRouterPath
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
      // TODO: can we remove this since the template is now just a re-export?
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
        // TODO: this should be doable within the unplugin
        if (useExperimentalTypedPages) {
          prerenderRoutes.clear()
          if (!rootPage) {
            // FIXME:
            throw new Error('Can this ever happen?')
          }

          // FIXME: this requires some code on the unplugin side
          for (const page of rootPage) {
            // if page has no children (is leaf) and has an optional param or a catch all param at the end, add
            if (!page.isPassThrough &&
              // does it no required params
              !page.params.some(p => !p.optional)
              // && any optional param is located at the end
            ) {
              prerenderRoutes.add(page.fullPath)
            }
          }
        } else {
          // Legacy pages:extend
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
        }
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
        { name: 'useLink', as: 'useLink', from: vueRouterPath }
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
    nuxt.hook('modules:done', () => {
      // TODO: fix broken definePageMeta() with unplugin-vue-router
      addVitePlugin(PageMetaPlugin.vite(pageMetaOptions))
      addWebpackPlugin(PageMetaPlugin.webpack(pageMetaOptions))
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
      console.log('👉 build:manifest')
      // const pages = await resolvePagesRoutes()
      // await nuxt.callHook('pages:extend', pages)

      // TODO: do we need the paths to be relative or can they be absolute?
      // NOTE: they used to be relative to the project root
      let sourceFiles: string[]
      sourceFiles = [...(rootPage || [])]
        .map(p => p.components.get('default'))
        .filter((v: unknown): v is string => !!v)
        .map(p => relative(nuxt.options.srcDir, p))

      // unplugin-vue-router already generates the routes before this hook
      if (!useExperimentalTypedPages) {
        const pages = await resolvePagesRoutes()
        await nuxt.callHook('pages:extend', pages)
        sourceFiles = getSources(pages)
      }

      for (const key in manifest) {
        if (manifest[key].isEntry) {
          manifest[key].dynamicImports =
            manifest[key].dynamicImports?.filter(i => !sourceFiles.includes(i))
        }
      }
    })

    // adds support for #vue-router alias
    addTemplate({
      filename: 'vue-router.mjs',
      getContents () {
        return `export * from '${vueRouterPath}';`
      }
    })
    addTemplate({
      filename: 'vue-router.d.ts',
      getContents () {
        return [
          useExperimentalTypedPages && 'import type { EditableTreeNode } from \'unplugin-vue-router\'',
          `export * from '${vueRouterPath}'`,
          useExperimentalTypedPages && `
declare module '@nuxt/schema' {
  export interface NuxtHooks {
    'pages:extendOne': (page: EditableTreeNode) => HookResult;
    'pages:beforeWrite': (rootPage: EditableTreeNode) => HookResult;
  }
}`
        ].filter(Boolean).join('\n')
      }
    })

    // Add routes template
    addTemplate({
      filename: 'routes.mjs',
      async getContents () {
        if (useExperimentalTypedPages) {
          return "export { routes as default } from 'vue-router/auto/routes';"
        }

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

    // TODO: Do we need to provide a fallback for this? Or can we just expose
    // `router.options` from the router instance itself
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

    nuxt.options.alias['#vue-router'] = join(nuxt.options.buildDir, 'vue-router')

    // Add declarations for middleware keys
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'types/middleware.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'types/layouts.d.ts') })
      references.push({ path: resolve(nuxt.options.buildDir, 'vue-router.d.ts') })
    })
  }
})
