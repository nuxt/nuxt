import { fileURLToPath } from 'node:url'

const testWithInlineVue = process.env.EXTERNAL_VUE === 'false'

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
  pages: false,
  devtools: { enabled: false },
  buildDir: testWithInlineVue ? '.nuxt-inline' : '.nuxt',
  sourcemap: false,
  experimental: {
    externalVue: !testWithInlineVue,
  },
  compatibilityDate: 'latest',
  nitro: {
    output: { dir: fileURLToPath(new URL(testWithInlineVue ? './.output-inline' : './.output', import.meta.url)) },
    minify: true,
  },
  // The bundle-size test runs under vitest, so `nuxt build` would otherwise
  // inherit `test: true` and skip production-only stripping (e.g. diagnostics
  // `why`/`fix` text). Force it off so we measure the real shipped bundle.
  test: false,
})
