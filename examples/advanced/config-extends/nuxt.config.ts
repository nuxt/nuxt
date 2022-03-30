import { defineNuxtConfig } from 'nuxt3'

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
