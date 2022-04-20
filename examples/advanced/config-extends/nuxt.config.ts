import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  extends: [
    './ui',
    './base'
  ],
  publicRuntimeConfig: {
    theme: {
      primaryColor: 'user_primary'
    }
  },
  modules: [
    '@nuxt/ui'
  ]
})
