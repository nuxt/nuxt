import { defineNuxtConfig } from 'nuxt3'
import { addComponent } from '@nuxt/kit'

export default defineNuxtConfig({
  buildDir: process.env.NITRO_BUILD_DIR,
  builder: process.env.TEST_WITH_WEBPACK ? 'webpack' : 'vite',
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
    reactivityTransform: true
  }
})
