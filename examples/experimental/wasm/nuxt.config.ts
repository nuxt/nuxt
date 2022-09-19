export default defineNuxtConfig({
  nitro: {
    experimental: {
      wasm: true
    }
  },
  modules: [
    '@nuxt/ui'
  ]
})
