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
    '/api/rule-headers/**': { headers: { 'cache-control': 'public, max-age=60' } },
    '/api/rule-headers/ctype': { headers: { 'content-type': 'application/x-from-rule' } },
    '/api/no-store/**': { headers: { 'cache-control': 'no-store' } },
  },
  compatibilityDate: 'latest',
  nitroLegacy: true,
})
