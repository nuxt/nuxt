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
          experimental: {
            appManifest: process.env.TEST_MANIFEST !== 'manifest-off'
          },
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
