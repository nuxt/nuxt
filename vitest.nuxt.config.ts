import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  // TODO: investigate
  define: {
    'import.meta.test': true
  },
  test: {
    dir: './test/nuxt',
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
