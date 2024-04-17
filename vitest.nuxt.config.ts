import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  resolve: {
    alias: {
      '#vue-router': 'vue-router',
    },
  },
  test: {
    dir: './test/nuxt',
    coverage: {
      include: ['packages/nuxt/src/app'],
    },
    environment: 'nuxt',
    setupFiles: [
      './test/setup-runtime.ts',
    ],
    environmentOptions: {
      nuxt: {
        overrides: {
          experimental: {
            appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
          },
          appConfig: {
            nuxt: {
              buildId: 'override',
            },
          },
        },
      },
    },
  },
})
