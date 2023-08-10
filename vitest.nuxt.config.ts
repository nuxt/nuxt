import { defineVitestConfig } from 'nuxt-vitest/config'

export default defineVitestConfig({
  test: {
    dir: './test/nuxt',
    environment: 'nuxt'
  }
})
