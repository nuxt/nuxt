import process from 'node:process'
import { resolve } from 'pathe'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { configDefaults, coverageConfigDefaults, defaultExclude, defineConfig } from 'vitest/config'
import { isCI, isWindows } from 'std-env'
import { getV8Flags } from '@codspeed/core'
import codspeedPlugin from '@codspeed/vitest-plugin'
import type { NuxtConfig } from 'nuxt/schema'
import { defu } from 'defu'

const commonSettings: NuxtConfig = {
  pages: true,
  routeRules: {
    '/specific-prerendered': { prerender: true },
    '/pre/test': { redirect: '/' },
    '/pre/**': { prerender: true },
  },
  experimental: {
    appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
    purgeCachedData: true,
    granularCachedData: true,
    alwaysRunFetchOnKeyChange: true,
  },
  imports: {
    polyfills: false,
  },
}

const projects: Record<string, NuxtConfig> = {
  'nuxt': {},
  'nuxt-legacy': {
    experimental: {
      alwaysRunFetchOnKeyChange: true,
    },
  },
}

export default defineConfig({
  test: {
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'playground', '**/test/', 'scripts'],
    },
    poolOptions: isCI ? { forks: { execArgv: getV8Flags() } } : undefined,
    projects: [
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
        define: {
          'import.meta.dev': 'globalThis.__TEST_DEV__',
        },
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
        define: {
          'import.meta.dev': 'globalThis.__TEST_DEV__',
        },
        resolve: {
          alias: {
            '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
            '#build/router.options.mjs': resolve('./test/mocks/router-options'),
            '#internal/nuxt/paths': resolve('./test/mocks/paths'),
            '#build/app.config.mjs': resolve('./test/mocks/app-config'),
            '#app': resolve('./packages/nuxt/dist/app'),
          },
        },
        test: {
          name: 'unit',
          benchmark: { include: [] },
          setupFiles: ['./test/setup-env.ts'],
          include: ['packages/**/*.{test,spec}.ts'],
          testTimeout: isWindows ? 60000 : 10000,
          // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
          exclude: [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt-universal',
          dir: './test/nuxt/universal',
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              overrides: { pages: false },
            },
          },
        },
      }),
      ...await Promise.all(Object.entries(projects).map(([project, config]) => defineVitestProject({
        define: {
          'import.meta.dev': 'globalThis.__TEST_DEV__',
        },
        test: {
          name: project,
          dir: './test/nuxt',
          exclude: [...defaultExclude, '**/universal/**'],
          environment: 'nuxt',
          setupFiles: ['./test/setup-runtime.ts'],
          env: {
            PROJECT: project,
          },
          environmentOptions: {
            nuxt: {
              overrides: defu(config, commonSettings),
            },
          },
        },
      }))),
    ],
  },
})
