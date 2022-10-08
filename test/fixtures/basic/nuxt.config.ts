import { addComponent, addVitePlugin, addWebpackPlugin } from '@nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'
import { createUnplugin } from 'unplugin'
import { withoutLeadingSlash } from 'ufo'

export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      link: [undefined],
      meta: [{ name: 'viewport', content: 'width=1024, initial-scale=1' }, { charset: 'utf-8' }]
    }
  },
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_WITH_WEBPACK ? 'webpack' : 'vite',
  theme: './extends/bar',
  css: ['~/assets/global.css'],
  extends: [
    './extends/node_modules/foo'
  ],
  nitro: {
    output: { dir: process.env.NITRO_OUTPUT_DIR },
    prerender: {
      routes: [
        '/random/a',
        '/random/b',
        '/random/c'
      ]
    }
  },
  publicRuntimeConfig: {
    testConfig: 123
  },
  privateRuntimeConfig: {
    privateConfig: 'secret_key'
  },
  modules: [
    '~/modules/example',
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
      const stripLayout = (page: NuxtPage) => ({
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
  hooks: {
    'prepare:types' ({ tsConfig }) {
      tsConfig.include = tsConfig.include.filter(i => i !== '../../../../**/*')
    },
    'modules:done' () {
      addComponent({
        name: 'CustomComponent',
        export: 'namedExport',
        filePath: '~/other-components-folder/named-export'
      })
    }
  },
  experimental: {
    inlineSSRStyles: id => !id.includes('assets.vue'),
    reactivityTransform: true,
    treeshakeClientOnly: true
  },
  appConfig: {
    fromNuxtConfig: true,
    nested: {
      val: 1
    }
  }
})
