import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
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
          pages: true,
          routeRules: {
            '/specific-prerendered': { prerender: true },
            '/pre/test': { redirect: '/' },
            '/pre/**': { prerender: true },
          },
          experimental: {
            purgeCachedData: true,
            granularCachedData: true,
            appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
          },
          imports: {
            polyfills: false,
          },
        },
      },
    },
  },
})
