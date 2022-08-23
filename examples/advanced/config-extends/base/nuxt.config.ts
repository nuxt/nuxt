import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  imports: {
    dirs: ['utils']
  },
  publicRuntimeConfig: {
    theme: {
      primaryColor: 'base_primary',
      secondaryColor: 'base_secondary'
    }
  }
})
