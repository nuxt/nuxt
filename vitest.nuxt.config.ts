import { defineVitestConfig } from 'nuxt-vitest/config'
import { coverageConfigDefaults } from 'vitest/config'

export default defineVitestConfig({
  // TODO: investigate
  define: {
    'import.meta.test': true
  },
  test: {
    dir: './test/nuxt',
    environment: 'nuxt',
    coverage: {
      // TODO: remove when we upgrade to vitest 0.34.0: https://github.com/vitest-dev/vitest/pull/3794
      exclude: [...coverageConfigDefaults.exclude, '**/virtual:nuxt:**'],
    },
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
