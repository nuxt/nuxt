import { addComponent, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'
import { createUnplugin } from 'unplugin'
import { withoutLeadingSlash } from 'ufo'

// (defined in nuxt/src/core/nitro.ts)
declare module 'nitropack' {
  interface NitroRouteConfig {
    ssr?: boolean
  }
}

export default defineNuxtConfig({
  app: {
    pageTransition: true,
    layoutTransition: true,
    head: {
      charset: 'utf-8',
      link: [undefined],
      meta: [{ name: 'viewport', content: 'width=1024, initial-scale=1' }, { charset: 'utf-8' }]
    }
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_WITH_WEBPACK ? 'webpack' : 'vite',
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
      '/route-rules/spa': { ssr: false }
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
  runtimeConfig: {
    baseURL: '',
    baseAPIToken: '',
    privateConfig: 'secret_key',
    public: {
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
      if (process.env.TEST_WITH_WEBPACK) { return }

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
    }
  ],
  vite: {
    logLevel: 'silent'
  },
  hooks: {
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
  experimental: {
    inlineSSRStyles: id => !!id && !id.includes('assets.vue'),
    componentIslands: true,
    reactivityTransform: true,
    treeshakeClientOnly: true,
    payloadExtraction: true,
    configSchema: true
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1
    }
  }
})
