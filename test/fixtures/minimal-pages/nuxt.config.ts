import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const nuxtEntry = fileURLToPath(new URL('../../../packages/nuxt/dist/index.mjs', import.meta.url))
const isStubbed = readFileSync(nuxtEntry, 'utf-8').includes('const _module = await jiti')

export default defineNuxtConfig({
  $production: {
    vite: {
      $client: {
        build: {
          rolldownOptions: {
            output: {
              chunkFileNames: '_nuxt/[name].js',
              entryFileNames: '_nuxt/[name].js',
            },
          },
        },
      },
    },
  },
  sourcemap: false,
  compatibilityDate: 'latest',
  typescript: {
    typeCheck: isStubbed ? false : 'build',
  },
})
