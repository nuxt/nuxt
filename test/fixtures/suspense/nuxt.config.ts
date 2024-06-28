import { fileURLToPath } from 'node:url'

const testWithInlineVue = process.env.EXTERNAL_VUE === 'false'

export default defineNuxtConfig({
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  compatibilityDate: '2024-06-28',
  experimental: {
    externalVue: !testWithInlineVue,
  },
  buildDir: testWithInlineVue ? '.nuxt-inline' : '.nuxt',
  nitro: {
    output: { dir: fileURLToPath(new URL(testWithInlineVue ? './.output-inline' : './.output', import.meta.url)) },
  },
  sourcemap: false,
})
