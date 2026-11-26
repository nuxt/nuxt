// stable chunk names, so the bundle test can list them
const build = {
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
}

export default defineNuxtConfig({
  $env: {
    // the classic router, to compare its bundle with the experimental one
    classic: {
      ...build,
      buildDir: '.nuxt-classic',
      experimental: {
        experimentalRouter: false,
      },
      nitro: {
        output: { dir: '.output-classic' },
      },
    },
  },
  $production: build,
  devtools: { enabled: false },
  sourcemap: false,
  // off by default before Nuxt 5
  experimental: {
    experimentalRouter: true,
  },
  compatibilityDate: 'latest',
  nitro: {
    minify: true,
  },
  // The bundle-size test runs under vitest, so `nuxt build` would otherwise
  // inherit `test: true` and skip production-only stripping (e.g. diagnostics
  // `why`/`fix` text). Force it off so we measure the real shipped bundle.
  test: false,
})
