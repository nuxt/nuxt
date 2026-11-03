export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  ui: {
    fonts: false,
  },
  compatibilityDate: 'latest',
  icon: {
    serverBundle: {
      collections: ['lucide', 'simple-icons'],
    },
  },
})
