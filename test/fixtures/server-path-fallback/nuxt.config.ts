export default defineNuxtConfig({
  $env: {
    'fallback-disabled': {
      buildDir: '.nuxt-fallback-disabled',
      experimental: { serverPathFallback: false },
      nitro: { output: { dir: '.output-fallback-disabled' } },
    },
  },
  devtools: { enabled: false },
  compatibilityDate: 'latest',
  nitro: {
    // `test/e2e/server-path-fallback.test.ts` serves this to emulate SPA-fallback hosting
    prerender: { routes: ['/200.html'] },
  },
})
