import { defineNuxtConfig } from 'nuxt3'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui'
  ],
  experimental: {
    reactivityTransform: true
  }
  // builder: 'webpack'
})
