import process from 'node:process'
import { resolve } from 'pathe'
import { defineVitestProject as _defineVitestProject } from '@nuxt/test-utils/config'
import { configDefaults, coverageConfigDefaults, defaultExclude, defineConfig } from 'vitest/config'
import { isCI, isWindows, provider } from 'std-env'
import { getV8Flags } from '@codspeed/core'
import codspeedPlugin from '@codspeed/vitest-plugin'
import type { NuxtConfig } from 'nuxt/schema'
import { defu } from 'defu'

// TODO: fix upstream in nuxt/test-utils
function defineVitestProject (config: Parameters<typeof _defineVitestProject>[0]) {
  return _defineVitestProject(defu({
    test: {
      environmentOptions: {
        nuxt: {
          overrides: { experimental: { nitroViteEnvironment: false } } satisfies NuxtConfig,
        },
      },
    },
  }, config))
}

const commonSettings: NuxtConfig = {
  pages: true,
  routeRules: {
    '/specific-prerendered': { prerender: true },
    '/isr/**': { isr: 60 },
    '/pre/test': { redirect: '/' },
    '/pre/spa/**': { prerender: true, ssr: false },
    '/pre/**': { prerender: true },
    // Decoded keys must match the percent-encoded path generated for a unicode page,
    // including when a catch-all rule sets the same key, and when folding an
    // encoded non-ASCII character is required to match.
    '/测试': { redirect: '/unicode-target' },
    '/unicode/**': { ssr: true },
    '/unicode/测试': { ssr: false },
    '/cafÉ': { redirect: '/accented-target' },
    [`/pre-encoded/${encodeURIComponent('测试')}`]: { redirect: '/pre-encoded-target' },
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
  builder: 'vite' | 'rspack' | 'webpack' | 'nitro-vite'
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
  // nitro-vite: only default context + manifest-on
  { env: 'dev', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on' },
  { env: 'built', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on' },
  // rspack: only manifest-on
  { env: 'dev', builder: 'rspack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'rspack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'rspack', context: 'default', manifest: 'manifest-on' },
  // webpack: only manifest-on
  { env: 'dev', builder: 'webpack', context: 'async', manifest: 'manifest-on' },
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
  }
}

const fixtureExclude = [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js']

export default defineConfig({
  test: {
    // required for the flakiness.io reporter to record test locations
    includeTaskLocation: isCI,
    onConsoleLog (log) {
      if (log.includes('<Suspense> is an experimental feature')) { return false }
    },
    reporters: [
      'default',
      ...provider === 'github_actions' ? ['github-actions' as const] : [],
      ['@flakiness/vitest', { flakinessProject: 'nuxt/nuxt' }],
    ],
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
          'import.meta.dev': '(globalThis.__TEST_DEV__ ?? false)',
        },
        test: {
          name: fixtureProjectName(entry),
          include: ['test/*.test.ts'],
          exclude: [...fixtureExclude, 'test/bundle.test.ts'],
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: isWindows ? 60000 : 20000,
          retry: isCI ? 2 : 0,
          benchmark: { include: [] },
          env: fixtureProjectEnv(entry),
        },
      })),
      {
        test: {
          name: 'bundle',
          include: ['test/bundle.test.ts'],
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: 180_000,
          retry: isCI ? 2 : 0,
          benchmark: { include: [] },
        },
      },
      {
        test: {
          name: 'no-jiti',
          include: ['test/no-jiti/*.test.ts'],
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: 300_000,
          benchmark: { include: [] },
        },
      },
      {
        define: {
          'import.meta.dev': '(globalThis.__TEST_DEV__ ?? false)',
          'import.meta.server': '(globalThis.__TEST_SERVER__ ?? false)',
        },
        resolve: {
          alias: {
            '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
            '#build/router.options.mjs': resolve('./test/mocks/router-options'),
            '#internal/nuxt.config.mjs': resolve('./test/mocks/nitro-nuxt-config'),
            '#internal/nuxt/nitro-config.mjs': resolve('./test/mocks/nitro-config'),
            '#internal/nuxt/paths': resolve('./test/mocks/paths'),
            '#build/app.config.mjs': resolve('./test/mocks/app-config'),
            '#app': resolve('./packages/nuxt/src/app'),
          },
        },
        test: {
          name: 'unit',
          benchmark: { include: [] },
          globalSetup: ['./test/setup-prepare.ts'],
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
          globalSetup: ['./test/setup-prepare.ts'],
          environmentOptions: {
            nuxt: {
              overrides: { pages: false },
            },
          },
        },
      }),
      ...await Promise.all(Object.entries(nuxtTestProjects).map(([project, config]) => defineVitestProject({
        define: {
          'import.meta.dev': '(globalThis.__TEST_DEV__ ?? false)',
        },
        test: {
          name: project,
          dir: './test/nuxt',
          exclude: [...defaultExclude, '**/universal/**', '**/dev/**', '**/insensitive/**', '**/sensitive/**'],
          environment: 'nuxt',
          globalSetup: ['./test/setup-prepare.ts'],
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
      await defineVitestProject({
        define: {
          'import.meta.dev': '(globalThis.__TEST_DEV__ ?? false)',
        },
        test: {
          name: 'nuxt-insensitive',
          dir: './test/nuxt/insensitive',
          environment: 'nuxt',
          setupFiles: ['./test/setup-runtime.ts'],
          environmentOptions: {
            nuxt: {
              // `sensitive: false` on a v5 app: the config the route-rule case-folding targets.
              overrides: defu({
                future: { compatibilityVersion: 5 },
                router: { options: { sensitive: false } },
                routeRules: {
                  '/Secret/Docs/**': { ssr: false },
                  '/Legacy/Home': { redirect: '/target' },
                },
              } satisfies NuxtConfig, commonSettings),
            },
          },
        },
      }),
      await defineVitestProject({
        define: {
          'import.meta.dev': '(globalThis.__TEST_DEV__ ?? false)',
        },
        test: {
          name: 'nuxt-sensitive',
          dir: './test/nuxt/sensitive',
          environment: 'nuxt',
          setupFiles: ['./test/setup-runtime.ts'],
          environmentOptions: {
            nuxt: {
              overrides: defu({
                future: { compatibilityVersion: 5 },
                router: { options: { sensitive: true } },
                routeRules: {
                  '/Admin/Dashboard': { redirect: '/admin-target' },
                  '/admin/dashboard': { redirect: '/lower-target' },
                },
              } satisfies NuxtConfig, commonSettings),
            },
          },
        },
      }),
      await defineVitestProject({
        define: {
          'import.meta.dev': 'true',
        },
        test: {
          name: 'nuxt-dev',
          dir: './test/nuxt/dev',
          environment: 'nuxt',
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-runtime.ts'],
          environmentOptions: {
            nuxt: {
              overrides: defu(nuxtTestProjects.nuxt, commonSettings),
            },
          },
        },
      }),
    ],
  },
})
