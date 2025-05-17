import { resolve } from 'pathe'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config'
import { isCI, isWindows } from 'std-env'
import { getV8Flags } from '@codspeed/core'
import codspeedPlugin from '@codspeed/vitest-plugin'

export default defineConfig({
  test: {
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'playground', '**/test/', 'scripts'],
    },
    poolOptions: isCI ? { forks: { execArgv: getV8Flags() } } : undefined,
    workspace: [
      {
        plugins: isCI ? [codspeedPlugin()] : [],
        test: {
          name: 'benchmark',
          pool: isCI ? 'forks' : undefined,
          include: [],
          benchmark: {
            include: ['**/*.bench.ts'],
          },
        },
      },
      {
        test: {
          name: 'fixtures',
          include: ['test/*.test.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: isWindows ? 60000 : 10000,
          // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
          exclude: [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js'],
          benchmark: { include: [] },
        },
      },
      {
        resolve: {
          alias: {
            '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
            '#build/router.options': resolve('./test/mocks/router-options'),
            '#internal/nuxt/paths': resolve('./test/mocks/paths'),
            '#build/app.config.mjs': resolve('./test/mocks/app-config'),
            '#app': resolve('./packages/nuxt/dist/app'),
          },
        },
        test: {
          name: 'unit',
          benchmark: { include: [] },
          setupFiles: ['./test/setup-env.ts'],
          include: ['packages/**/*.test.ts'],
          testTimeout: isWindows ? 60000 : 10000,
          // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
          exclude: [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          dir: './test/nuxt',
          environment: 'nuxt',
          setupFiles: ['./test/setup-runtime.ts'],
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
                  alwaysRunFetchOnKeyChange: true,
                },
                imports: {
                  polyfills: false,
                },
              },
            },
          },
        },
      }),
    ],
  },
})
