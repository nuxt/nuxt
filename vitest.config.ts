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
    '/pre/spa/**': { prerender: true, ssr: false },
    '/pre/**': { prerender: true },
  },
  experimental: {
    appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
  },
  imports: {
    polyfills: false,
  },
}

const nuxtTestProjects: Record<string, NuxtConfig> = {
  'nuxt': {
    future: {
      compatibilityVersion: 5,
    },
  },
  'nuxt-legacy': {
    future: {
      compatibilityVersion: 4,
    },
    experimental: {
      alwaysRunFetchOnKeyChange: true,
    },
  },
}

// Matrix combinations for fixture tests (matches CI matrix with exclusions)
interface FixtureMatrixEntry {
  env: 'dev' | 'built'
  builder: 'vite' | 'rspack' | 'webpack'
  context: 'async' | 'default'
  manifest: 'manifest-on' | 'manifest-off'
}

const fixtureMatrix: FixtureMatrixEntry[] = [
  // vite: all combinations
  { env: 'dev', builder: 'vite', context: 'async', manifest: 'manifest-on' },
  { env: 'dev', builder: 'vite', context: 'async', manifest: 'manifest-off' },
  { env: 'dev', builder: 'vite', context: 'default', manifest: 'manifest-on' },
  { env: 'dev', builder: 'vite', context: 'default', manifest: 'manifest-off' },
  { env: 'built', builder: 'vite', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'vite', context: 'async', manifest: 'manifest-off' },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-on' },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-off' },
  // rspack: only built + manifest-on
  { env: 'built', builder: 'rspack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'rspack', context: 'default', manifest: 'manifest-on' },
  // webpack: only built + manifest-on
  { env: 'built', builder: 'webpack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'webpack', context: 'default', manifest: 'manifest-on' },
]

function fixtureProjectName (entry: FixtureMatrixEntry) {
  return `fixtures:${entry.builder}-${entry.env}-${entry.context}-${entry.manifest}`
}

function fixtureProjectEnv (entry: FixtureMatrixEntry) {
  return {
    TEST_ENV: entry.env,
    TEST_BUILDER: entry.builder,
    TEST_CONTEXT: entry.context,
    TEST_MANIFEST: entry.manifest,
    SKIP_BUNDLE_SIZE: 'true',
  }
}

const fixtureExclude = [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js']

export default defineConfig({
  test: {
    onConsoleLog (log) {
      if (log.includes('<Suspense> is an experimental feature')) { return false }
    },
    coverage: {
      exclude: [...coverageConfigDefaults.exclude, 'playground', '**/test/', 'scripts'],
    },
    execArgv: isCI ? getV8Flags() : undefined,
    projects: [
      {
        plugins: isCI ? [codspeedPlugin()] : [],
        test: {
          name: 'benchmark',
          include: [],
          benchmark: {
            include: ['**/*.bench.ts'],
          },
        },
      },
      ...fixtureMatrix.map(entry => ({
        define: {
          'import.meta.dev': 'globalThis.__TEST_DEV__',
        },
        test: {
          name: fixtureProjectName(entry),
          include: ['test/*.test.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: isWindows ? 60000 : 10000,
          retry: isCI ? 2 : 0,
          exclude: fixtureExclude,
          benchmark: { include: [] },
          env: fixtureProjectEnv(entry),
        },
      })),
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
          exclude: fixtureExclude,
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
      ...await Promise.all(Object.entries(nuxtTestProjects).map(([project, config]) => defineVitestProject({
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
