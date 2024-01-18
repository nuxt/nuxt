import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    dir: './test/nuxt',
    coverage: {
      include: ['packages/nuxt/src/app']
    },
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        overrides: {
          appConfig: {
            nuxt: {
              buildId: 'override'
            }
          }
        }
      }
    }
  }
})
