import { defineVitestConfig } from 'nuxt-vitest/config'

export default defineVitestConfig({
  test: {
    dir: './test/nuxt',
    environment: 'nuxt'
  },
  define: {
    'import.meta.client': true,
    'import.meta.server': false
  }
})
