import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const testWithInlineVue = process.env.EXTERNAL_VUE === 'false'

const nuxtEntry = fileURLToPath(new URL('../../../packages/nuxt/dist/index.mjs', import.meta.url))
const isStubbed = readFileSync(nuxtEntry, 'utf-8').includes('const _module = jiti')

export default defineNuxtConfig({
  $production: {
    vite: {
      $client: {
        build: {
          rollupOptions: {
            output: {
              chunkFileNames: '_nuxt/[name].js',
              entryFileNames: '_nuxt/[name].js',
            },
          },
        },
      },
    },
  },
  pages: false,
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
  typescript: {
    typeCheck: isStubbed ? false : 'build',
  },
})
