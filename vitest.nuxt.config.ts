import { defineVitestConfig } from 'nuxt-vitest/config'

export default defineVitestConfig({
  test: {
    dir: './test/nuxt',
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        overrides: {
          appConfig: {
            nuxt: {
              buildId: 'test'
            }
          }
        }
      }
    }
  }
})
