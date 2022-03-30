import { defineNuxtConfig } from 'nuxt3'

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
