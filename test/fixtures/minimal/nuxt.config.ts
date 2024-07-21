import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const testWithInlineVue = process.env.EXTERNAL_VUE === 'false'

const nuxtEntry = fileURLToPath(new URL('../../../packages/nuxt/dist/index.mjs', import.meta.url))
const isStubbed = readFileSync(nuxtEntry, 'utf-8').includes('const _module = await jiti')

export default defineNuxtConfig({
  compatibilityDate: '2024-06-28',
  typescript: {
    typeCheck: isStubbed ? false : 'build',
  },
  pages: false,
  experimental: {
    externalVue: !testWithInlineVue,
  },
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
  buildDir: testWithInlineVue ? '.nuxt-inline' : '.nuxt',
  nitro: {
    output: { dir: fileURLToPath(new URL(testWithInlineVue ? './.output-inline' : './.output', import.meta.url)) },
  },
  sourcemap: false,
})
