export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'NuxtTime',
      meta: [{ name: 'description', content: 'NuxtTime test fixture' }],
    },
  },
  compatibilityDate: 'latest',
})
