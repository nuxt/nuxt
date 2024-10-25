import { fileURLToPath } from 'node:url'

const testWithInlineVue = process.env.EXTERNAL_VUE === 'false'

export default defineNuxtConfig({
  buildDir: testWithInlineVue ? '.nuxt-inline' : '.nuxt',
  sourcemap: false,
  future: { compatibilityVersion: process.env.TEST_V4 === 'true' ? 4 : 3 },
  experimental: {
    externalVue: !testWithInlineVue,
  },
  compatibilityDate: '2024-06-28',
  nitro: {
    output: { dir: fileURLToPath(new URL(testWithInlineVue ? './.output-inline' : './.output', import.meta.url)) },
  },
})
