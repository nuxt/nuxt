export default defineNuxtConfig({
  modules: ['./modules/legacy'],
  devtools: { enabled: false },
  runtimeConfig: {
    secret: 'legacy-secret',
    public: {
      flavour: 'earl-grey',
    },
  },
  routeRules: {
    '/api/no-store/**': { headers: { 'cache-control': 'no-store' } },
  },
  compatibilityDate: 'latest',
  nitroLegacy: true,
})
