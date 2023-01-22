export default defineNuxtConfig({
  extends: [
    './ui',
    './base'
  ],
  runtimeConfig: {
    public: {
      theme: {
        primaryColor: 'user_primary'
      }
    }
  },
  modules: [
    '@nuxt/ui'
  ]
})
