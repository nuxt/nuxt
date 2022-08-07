import { defineNuxtConfig } from 'nuxt'
import { addComponent } from '@nuxt/kit'

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
  extends: [
    './extends/bar',
    './extends/node_modules/foo'
  ],
  nitro: {
    output: { dir: process.env.NITRO_OUTPUT_DIR }
  },
  publicRuntimeConfig: {
    testConfig: 123
  },
  privateRuntimeConfig: {
    privateConfig: 'secret_key'
  },
  modules: ['~/modules/example'],
  hooks: {
    'modules:done' () {
      addComponent({
        name: 'CustomComponent',
        export: 'namedExport',
        filePath: '~/other-components-folder/named-export'
      })
    }
  },
  experimental: {
    reactivityTransform: true,
    treeshakeClientOnly: true
  }
})
