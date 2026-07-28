export default defineNuxtConfig({
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Lazy hydration',
      meta: [{ name: 'description', content: 'Lazy hydration test fixture' }],
    },
  },
  features: {
    inlineStyles: false,
  },
  compatibilityDate: 'latest',
})
