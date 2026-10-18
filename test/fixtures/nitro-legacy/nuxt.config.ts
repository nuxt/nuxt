export default defineNuxtConfig({
  modules: ['./modules/legacy'],
  devtools: { enabled: false },
  runtimeConfig: {
    secret: 'legacy-secret',
    public: {
      flavour: 'earl-grey',
    },
  },
  compatibilityDate: 'latest',
  nitroLegacy: true,
})
