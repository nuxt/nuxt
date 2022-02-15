import { defineNuxtConfig } from 'nuxt3'

export default defineNuxtConfig({
  buildDir: process.env.NITRO_BUILD_DIR,
  nitro: {
    output: { dir: process.env.NITRO_OUTPUT_DIR }
  },
  publicRuntimeConfig: {
    // @ts-ignore TODO: Fix schema types
    testConfig: '123'
  },
  modules: ['~/modules/example']
})
