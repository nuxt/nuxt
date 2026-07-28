export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Preview',
      meta: [{ name: 'description', content: 'Preview mode test fixture' }],
    },
  },
  compatibilityDate: 'latest',
})
