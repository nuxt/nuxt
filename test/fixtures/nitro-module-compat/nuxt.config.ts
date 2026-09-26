export default defineNuxtConfig({
  modules: ['./modules/untagged'],
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      flavour: 'earl-grey',
    },
  },
  routeRules: {
    '/api/untagged-rules': { headers: { 'x-untagged': 'rules' } },
  },
  compatibilityDate: 'latest',
})
