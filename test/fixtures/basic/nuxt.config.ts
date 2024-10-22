import { addBuildPlugin, addComponent } from 'nuxt/kit'
import type { NuxtPage } from 'nuxt/schema'
import { defu } from 'defu'
import { createUnplugin } from 'unplugin'
import { withoutLeadingSlash } from 'ufo'

// (defined in nuxt/src/core/nitro.ts)
declare module 'nitropack' {
  interface NitroRouteConfig {
    ssr?: boolean
  }
}

export default defineNuxtConfig({
  appId: 'nuxt-app-basic',
  extends: [
    './extends/node_modules/foo',
  ],
  // this produces an order of `~` > `~/extends/bar` > `~/extends/node_modules/foo`
  theme: './extends/bar',
  modules: [
    function (_options, nuxt) {
      // ensure setting `runtimeConfig` also sets `nitro.runtimeConfig`
      nuxt.options.runtimeConfig = defu(nuxt.options.runtimeConfig, {
        public: {
          testConfig: 123,
        },
      })
    },
    function (_options, nuxt) {
      nuxt.hook('modules:done', () => {
        // @ts-expect-error not valid nuxt option
        if (!nuxt.options.__installed_layer) {
          throw new Error('layer in layers/ directory was not auto-registered')
        }
      })
    },
    '~/modules/subpath',
    './modules/test',
    '~/modules/example',
    function (_, nuxt) {
      if (typeof nuxt.options.builder === 'string' && nuxt.options.builder.includes('webpack')) { return }

      nuxt.options.css.push('virtual.css')
      nuxt.options.build.transpile.push('virtual.css')
      const plugin = createUnplugin(() => ({
        name: 'virtual',
        resolveId (id) {
          if (id === 'virtual.css') { return 'virtual.css' }
        },
        load (id) {
          if (id.includes('virtual.css')) { return ':root { --virtual: red }' }
        },
      }))
      addBuildPlugin(plugin)
    },
    function (_options, nuxt) {
      nuxt.hook('pages:extend', (pages) => {
        pages.push({
          path: '/manual-redirect',
          redirect: '/',
        })
      })
    },
    function (_options, nuxt) {
      const routesToDuplicate = ['/async-parent', '/fixed-keyed-child-parent', '/keyed-child-parent', '/with-layout', '/with-layout2']
      const stripLayout = (page: NuxtPage): NuxtPage => ({
        ...page,
        children: page.children?.map(child => stripLayout(child)),
        name: 'internal-' + page.name,
        path: withoutLeadingSlash(page.path),
        meta: {
          ...page.meta,
          layout: undefined,
          _layout: page.meta?.layout,
        },
      })
      nuxt.hook('pages:resolved', (pages) => {
        const newPages = []
        for (const page of pages) {
          if (routesToDuplicate.includes(page.path)) {
            newPages.push(stripLayout(page))
          }
        }
        const internalParent = pages.find(page => page.path === '/internal-layout')
        internalParent!.children = newPages
      })
    },
    function (_options, nuxt) {
      // to check that page metadata is preserved
      nuxt.hook('pages:resolved', (pages) => {
        const customName = pages.find(page => page.name === 'some-custom-name')
        if (!customName) { throw new Error('Page with custom name not found') }
        if (customName.path !== '/some-custom-path') { throw new Error('Page path not extracted') }

        customName.meta ||= {}
        customName.meta.someProp = true
      })
    },
    // To test falsy module values
    undefined,
  ],
  app: {
    pageTransition: true,
    layoutTransition: true,
    teleportId: 'nuxt-teleport',
    teleportTag: 'span',
    head: {
      charset: 'utf-8',
      link: [undefined],
      meta: [
        { name: 'viewport', content: 'width=1024, initial-scale=1' },
        { charset: 'utf-8' },
        { name: 'description', content: 'Nuxt Fixture' },
      ],
    },
    keepalive: {
      include: ['keepalive-in-config', 'not-keepalive-in-nuxtpage'],
    },
  },
  css: ['~/assets/global.css'],
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => {
        return tag === 'custom-component'
      },
    },
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1,
    },
  },
  runtimeConfig: {
    public: {
      needsFallback: undefined,
    },
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_BUILDER as 'webpack' | 'rspack' | 'vite' ?? 'vite',
  build: {
    transpile: [
      (ctx) => {
        if (typeof ctx.isDev !== 'boolean') { throw new TypeError('context not passed') }
        return false
      },
    ],
  },
  optimization: {
    keyedComposables: [
      {
        name: 'useCustomKeyedComposable',
        source: '~/other-composables-folder/custom-keyed-composable',
        argumentLength: 1,
      },
    ],
  },
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  features: {
    inlineStyles: id => !!id && !id.includes('assets.vue'),
  },
  experimental: {
    typedPages: true,
    polyfillVueUseHead: true,
    respectNoSSRHeader: true,
    clientFallback: true,
    restoreState: true,
    clientNodeCompat: true,
    componentIslands: {
      selectiveClient: 'deep',
    },
    treeshakeClientOnly: true,
    asyncContext: process.env.TEST_CONTEXT === 'async',
    appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
    renderJsonPayloads: process.env.TEST_PAYLOAD !== 'js',
    headNext: true,
    inlineRouteRules: true,
  },
  compatibilityDate: '2024-06-28',
  nitro: {
    publicAssets: [
      {
        dir: '../custom-public',
        baseURL: '/custom',
      },
    ],
    esbuild: {
      options: {
        // in order to test bigint serialization
        target: 'es2022',
      },
    },
    routeRules: {
      '/route-rules/spa': { ssr: false },
      '/redirect/catchall': { ssr: false },
      '/route-rules/middleware': { appMiddleware: 'route-rules-middleware' },
      '/hydration/spa-redirection/**': { ssr: false },
      '/no-scripts': { experimentalNoScripts: true },
      '/prerender/**': { prerender: true },
    },
    output: { dir: process.env.NITRO_OUTPUT_DIR },
    prerender: {
      routes: [
        '/random/a',
        '/random/b',
        '/random/c',
        '/prefetch/server-components',
      ],
    },
  },
  vite: {
    logLevel: 'silent',
    build: {
      assetsInlineLimit: 100, // keep SVG as assets URL
    },
  },
  postcss: {
    plugins: {
      '~/postcss/plugin': {},
    },
  },
  telemetry: false, // for testing telemetry types - it is auto-disabled in tests
  hooks: {
    'webpack:config' (configs) {
      // in order to test bigint serialization we need to set target to a more modern one
      for (const config of configs) {
        const esbuildRules = config.module!.rules!.filter(
          rule => typeof rule === 'object' && rule && 'loader' in rule && rule.loader === 'esbuild-loader',
        )
        for (const rule of esbuildRules) {
          if (typeof rule === 'object' && typeof rule.options === 'object') {
            rule.options.target = 'es2022'
          }
        }
      }
    },
    'modules:done' () {
      addComponent({
        name: 'CustomComponent',
        export: 'namedExport',
        filePath: '~/other-components-folder/named-export',
      })
    },
    'components:extend' (components) {
      for (const comp of components) {
        if (comp.pascalName === 'GlobalSync') {
          comp.global = 'sync'
        }
      }
    },
    'vite:extendConfig' (config) {
      config.plugins!.push({
        name: 'nuxt:server',
        configureServer (server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/vite-plugin-without-path') {
              res.end('vite-plugin without path')
              return
            }
            next()
          })

          server.middlewares.use((req, res, next) => {
            if (req.url === '/__nuxt-test') {
              res.end('vite-plugin with __nuxt prefix')
              return
            }
            next()
          })
        },
      })
    },
  },
})
