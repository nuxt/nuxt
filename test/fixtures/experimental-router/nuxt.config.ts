export default defineNuxtConfig({
  devtools: { enabled: false },
  // the default in Nuxt 5, set explicitly so the fixture keeps testing it
  experimental: {
    experimentalRouter: true,
  },
  compatibilityDate: 'latest',
})
