export default defineNuxtConfig({
  features: {
    inlineStyles: id => !!id && id.includes('.vue'),
  },
  compatibilityDate: 'latest',
})
