export default defineNuxtConfig({
  devtools: { enabled: false },
  compatibilityDate: 'latest',
  nitro: {
    // `test/e2e/server-path-fallback.test.ts` serves this to emulate SPA-fallback hosting
    prerender: { routes: ['/200.html'] },
  },
})
