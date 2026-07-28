export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ['~/assets/global.css'],
  features: {
    inlineStyles: false,
  },
  experimental: {
    restoreState: true,
  },
  compatibilityDate: 'latest',
})
