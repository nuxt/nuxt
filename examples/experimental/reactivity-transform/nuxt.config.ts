import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui'
  ],
  experimental: {
    reactivityTransform: true
  }
  // builder: 'webpack'
})
