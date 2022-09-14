export default defineNuxtConfig({
  nitro: {
    experiments: {
      wasm: true
    }
  },
  modules: [
    '@nuxt/ui'
  ]
})
