import { addComponent, addVitePlugin, addWebpackPlugin } from 'nuxt/kit'
import type { NuxtPage } from 'nuxt/schema'
import { createUnplugin } from 'unplugin'
import { withoutLeadingSlash } from 'ufo'

// (defined in nuxt/src/core/nitro.ts)
declare module 'nitropack' {
  interface NitroRouteConfig {
    ssr?: boolean
  }
}

export default defineNuxtConfig({
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        // TODO: For testing (future) support for Node16-style module resolution.
        // See https://github.com/nuxt/nuxt/issues/18426 and https://github.com/nuxt/nuxt/pull/18431
        // moduleResolution: 'Node16'
      }
    }
  },
  app: {
    pageTransition: true,
    layoutTransition: true,
    head: {
      charset: 'utf-8',
      link: [undefined],
      meta: [
        { name: 'viewport', content: 'width=1024, initial-scale=1' },
        { charset: 'utf-8' },
        { name: 'description', content: 'Nuxt Fixture' }
      ]
    }
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_BUILDER as 'webpack' | 'vite' ?? 'vite',
  build: {
    transpile: [
      (ctx) => {
        if (typeof ctx.isDev !== 'boolean') { throw new TypeError('context not passed') }
        return false
      }
    ]
  },
  theme: './extends/bar',
  css: ['~/assets/global.css'],
  extends: [
    './extends/node_modules/foo'
  ],
  nitro: {
    routeRules: {
      '/route-rules/spa': { ssr: false },
      '/no-scripts': { experimentalNoScripts: true }
    },
    output: { dir: process.env.NITRO_OUTPUT_DIR },
    prerender: {
      routes: [
        '/random/a',
        '/random/b',
        '/random/c'
      ]
    }
  },
  optimization: {
    keyedComposables: [
      {
        name: 'useKeyedComposable',
        argumentLength: 1
      }
    ]
  },
  runtimeConfig: {
    baseURL: '',
    baseAPIToken: '',
    privateConfig: 'secret_key',
    public: {
      ids: [1, 2, 3],
      needsFallback: undefined,
      testConfig: 123
    }
  },
  modules: [
    [
      '~/modules/example',
      {
        typeTest (val) {
          // @ts-expect-error module type defines val as boolean
          const b: string = val
          return !!b
        }
      }
    ],
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
          if (id === 'virtual.css') { return ':root { --virtual: red }' }
        }
      }))
      addVitePlugin(plugin.vite())
      addWebpackPlugin(plugin.webpack())
    },
    function (_options, nuxt) {
      const routesToDuplicate = ['/async-parent', '/fixed-keyed-child-parent', '/keyed-child-parent', '/with-layout', '/with-layout2']
      const stripLayout = (page: NuxtPage): NuxtPage => ({
        ...page,
        children: page.children?.map(child => stripLayout(child)),
        name: 'internal-' + page.name,
        path: withoutLeadingSlash(page.path),
        meta: {
          ...page.meta || {},
          layout: undefined,
          _layout: page.meta?.layout
        }
      })
      nuxt.hook('pages:extend', (pages) => {
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
    function (_, nuxt) {
      nuxt.options.optimization.treeShake.composables.server[nuxt.options.rootDir] = ['useClientOnlyComposable', 'setTitleToPink']
      nuxt.options.optimization.treeShake.composables.client[nuxt.options.rootDir] = ['useServerOnlyComposable']
    },
    // To test falsy module values
    undefined
  ],
  vite: {
    logLevel: 'silent'
  },
  telemetry: false, // for testing telemetry types - it is auto-disabled in tests
  hooks: {
    'schema:extend' (schemas) {
      schemas.push({
        appConfig: {
          someThing: {
            value: {
              $default: 'default',
              $schema: {
                tsType: 'string | false'
              }
            }
          }
        }
      })
    },
    'prepare:types' ({ tsConfig }) {
      tsConfig.include = tsConfig.include!.filter(i => i !== '../../../../**/*')
    },
    'modules:done' () {
      addComponent({
        name: 'CustomComponent',
        export: 'namedExport',
        filePath: '~/other-components-folder/named-export'
      })
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
        }
      })
    }
  },
  vue: {
    compilerOptions: {
      isCustomElement: (tag) => {
        return tag === 'custom-component'
      }
    }
  },
  experimental: {
    polyfillVueUseHead: true,
    renderJsonPayloads: process.env.TEST_PAYLOAD !== 'js',
    respectNoSSRHeader: true,
    clientFallback: true,
    restoreState: true,
    inlineSSRStyles: id => !!id && !id.includes('assets.vue'),
    componentIslands: true,
    reactivityTransform: true,
    treeshakeClientOnly: true,
    payloadExtraction: true
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1
    }
  }
})
