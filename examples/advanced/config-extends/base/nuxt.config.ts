import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  autoImports: {
    dirs: ['utils']
  },
  publicRuntimeConfig: {
    theme: {
      primaryColor: 'base_primary',
      secondaryColor: 'base_secondary'
    }
  }
})
