import process from 'node:process'
import { resolve } from 'pathe'
import { defineVitestProject as _defineVitestProject } from '@nuxt/test-utils/config'
import { configDefaults, coverageConfigDefaults, defaultExclude, defineConfig } from 'vitest/config'
import { isCI, isWindows, provider } from 'std-env'
import { getV8Flags } from '@codspeed/core'
import codspeedPlugin from '@codspeed/vitest-plugin'
import type { NuxtConfig } from 'nuxt/schema'
import type { Plugin } from 'vite'
import { defu } from 'defu'

// vitest evaluates `define` entries for `import.meta.*` once when the worker starts, so a value
// referencing a global no longer tracks changes made by a test. Replace the flags in source instead,
// which keeps them readable at call time and lets tests toggle them with `vi.stubGlobal`.
function runtimeImportMeta (flags: Record<string, string>): Plugin {
  const pattern = new RegExp(`\\bimport\\.meta\\.(${Object.keys(flags).join('|')})\\b`, 'g')
  return {
    name: 'nuxt:test-runtime-import-meta',
    enforce: 'pre',
    transform (code) {
      if (!pattern.test(code)) { return }
      pattern.lastIndex = 0
      const transformed = code.replace(pattern, (match, flag: string, index: number) => {
        // `import.meta.*` also appears as a `define` key in build code, which must stay a literal
        const quoted = /['"`]/.test(code[index - 1] || '') && /['"`]/.test(code[index + match.length] || '')
        return quoted ? match : flags[flag]!
      })
      return { code: transformed, map: null }
    },
  }
}

// TODO: fix upstream in nuxt/test-utils
function defineVitestProject (config: Parameters<typeof _defineVitestProject>[0]) {
  return _defineVitestProject(defu({
    resolve: {
      // `@nuxt/test-utils` still references the `vitest/environments` entrypoint removed in vitest 5
      // https://github.com/nuxt/test-utils/blob/main/src/environments/vitest.ts
      alias: { 'vitest/environments': 'vitest/runtime' },
    },
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
    '/测试': { redirect: '/unicode-target' },
    '/unicode/**': { ssr: true },
    '/unicode/测试': { ssr: false },
    '/cafÉ': { redirect: '/accented-target' },
    [`/pre-encoded/${encodeURIComponent('测试')}`]: { redirect: '/pre-encoded-target' },
  },
  experimental: {
    appManifest: process.env.TEST_MANIFEST !== 'manifest-off',
    serverPathFallback: false,
  },
  imports: {
    polyfills: false,
  },
}

// Matrix combinations for fixture tests (matches CI matrix with exclusions)
interface FixtureMatrixEntry {
  env: 'dev' | 'built'
  builder: 'vite' | 'rsbuild' | 'rspack' | 'webpack' | 'nitro-vite'
  context: 'async' | 'default'
  manifest: 'manifest-on' | 'manifest-off'
  legacyErrors?: boolean
  islands?: 'v2'
  legacyComponentResolution?: boolean
}

const fixtureMatrix: FixtureMatrixEntry[] = [
  // async context and app manifest off are only asserted on in vite builds, each on its own
  { env: 'dev', builder: 'vite', context: 'default', manifest: 'manifest-on' },
  { env: 'built', builder: 'vite', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-on' },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-off' },
  { env: 'dev', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on' },
  { env: 'built', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on' },
  { env: 'dev', builder: 'rsbuild', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'rsbuild', context: 'default', manifest: 'manifest-on' },
  { env: 'dev', builder: 'rspack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'rspack', context: 'default', manifest: 'manifest-on' },
  { env: 'dev', builder: 'webpack', context: 'async', manifest: 'manifest-on' },
  { env: 'built', builder: 'webpack', context: 'default', manifest: 'manifest-on' },
]

// The matrix above runs with `experimental.inlineErrorRendering` at its default, which is on from
// compatibility version 5. These re-run every suite asserting on an error response with it off.
const legacyErrorMatrix: FixtureMatrixEntry[] = [
  { env: 'built', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on', legacyErrors: true },
  { env: 'dev', builder: 'vite', context: 'default', manifest: 'manifest-on', legacyErrors: true },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-on', legacyErrors: true },
]

// The same islands suite against the islands v2 fixture, on the builders that implementation supports.
const islandsV2Matrix: FixtureMatrixEntry[] = [
  { env: 'dev', builder: 'vite', context: 'default', manifest: 'manifest-on', islands: 'v2' },
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-on', islands: 'v2' },
  { env: 'dev', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on', islands: 'v2' },
  { env: 'built', builder: 'nitro-vite', context: 'default', manifest: 'manifest-on', islands: 'v2' },
]

const legacyErrorInclude = ['test/basic.test.ts', 'test/server-components.test.ts', 'test/vite-server-dev-error.test.ts', 'test/dev-error-*.test.ts']

// re-runs the basic fixture with `experimental.compilerComponentResolution` disabled
const legacyComponentResolutionMatrix: FixtureMatrixEntry[] = [
  { env: 'built', builder: 'vite', context: 'default', manifest: 'manifest-on', legacyComponentResolution: true },
]

function fixtureProjectInclude (entry: FixtureMatrixEntry) {
  if (entry.legacyErrors) { return legacyErrorInclude }
  if (entry.legacyComponentResolution) { return ['test/basic.test.ts'] }
  if (entry.islands) { return ['test/server-components.test.ts'] }
  return ['test/*.test.ts']
}

function fixtureProjectName (entry: FixtureMatrixEntry) {
  return `fixtures:${entry.builder}-${entry.env}-${entry.context}-${entry.manifest}${entry.legacyErrors ? '-legacy-errors' : ''}${entry.legacyComponentResolution ? '-legacy-component-resolution' : ''}${entry.islands ? `-${entry.islands}` : ''}`
}

function fixtureProjectEnv (entry: FixtureMatrixEntry) {
  return {
    TEST_ENV: entry.env,
    TEST_BUILDER: entry.builder,
    TEST_CONTEXT: entry.context,
    TEST_MANIFEST: entry.manifest,
    ...entry.legacyErrors ? { TEST_ERROR_RENDERING: 'legacy-errors' } : {},
    ...entry.islands ? { TEST_ISLANDS: entry.islands } : {},
    ...entry.legacyComponentResolution ? { TEST_COMPONENT_RESOLUTION: 'legacy' } : {},
  }
}

const fixtureExclude = [...configDefaults.exclude, 'test/e2e/**', 'e2e/**', 'nuxt/**', '**/test.ts', '**/this-should-not-load.spec.js']

// stands in for the defines and aliases a server builder applies in its own bundle
function rendererProject (name: string, include: string[], rendererConfig: string, fixtureDir = './test/fixtures/standalone-renderer') {
  const artifact = (path: string) => resolve(fixtureDir, '.nuxt', path)
  return {
    define: {
      'import.meta.dev': 'false',
      'import.meta.server': 'true',
      'import.meta.client': 'false',
      'import.meta.prerender': 'false',
    },
    resolve: {
      alias: {
        'nuxt/internal/renderer-config': resolve(rendererConfig),
        'nuxt/internal/entry': artifact('renderer/entry.mjs'),
        'nuxt/internal/manifest': artifact('renderer/manifest.mjs'),
        'nuxt/internal/precomputed': artifact('renderer/precomputed.mjs'),
        'nuxt/internal/styles': artifact('renderer/styles.mjs'),
        'nuxt/internal/entry-ids': artifact('renderer/entry-ids.mjs'),
        'nuxt/internal/entry-chunk': artifact('renderer/entry-chunk.mjs'),
        'nuxt/internal/renderer-plugins': artifact('renderer/renderer-plugins.mjs'),
        '#build': artifact(''),
        // provided by the server builder in a real build; the fixture writes them out
        '#internal/nuxt/paths': artifact('paths.mjs'),
      },
    },
    test: {
      name,
      include,
      globalSetup: ['./test/setup-renderer-prepare.ts'],
      testTimeout: 60_000,
      benchmark: { include: [] },
    },
  }
}

const rendererProjects = [
  rendererProject('renderer', ['test/renderer/*.test.ts', '!test/renderer/legacy-errors.test.ts'], './test/fixtures/standalone-renderer/.nuxt/renderer/renderer-config.mjs'),
  rendererProject('renderer-legacy-errors', ['test/renderer/legacy-errors.test.ts'], './test/fixtures/standalone-renderer/renderer-config-legacy-errors.mjs'),
]

const benchmarkRendererProject = rendererProject('benchmark-renderer', [], './test/fixtures/bench-renderer/.nuxt/renderer/renderer-config.mjs', './test/fixtures/bench-renderer')

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
          globalSetup: ['./test/bench/setup.ts'],
          testTimeout: 300_000,
          hookTimeout: 120_000,
          benchmark: {
            include: ['**/*.bench.ts'],
            exclude: [...defaultExclude, 'test/bench/renderer.bench.ts'],
          },
        },
      },
      {
        ...benchmarkRendererProject,
        plugins: isCI ? [codspeedPlugin()] : [],
        test: {
          ...benchmarkRendererProject.test,
          globalSetup: ['./test/bench/setup-renderer.ts'],
          testTimeout: 300_000,
          benchmark: { include: ['test/bench/renderer.bench.ts'] },
        },
      },
      ...[...fixtureMatrix, ...legacyErrorMatrix, ...legacyComponentResolutionMatrix, ...islandsV2Matrix].map(entry => ({
        plugins: [runtimeImportMeta({ dev: '(globalThis.__TEST_DEV__ ?? false)' })],
        test: {
          name: fixtureProjectName(entry),
          include: fixtureProjectInclude(entry),
          exclude: [...fixtureExclude, 'test/bundle.test.ts'],
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-env.ts'],
          testTimeout: isWindows ? 60000 : 20000,
          retry: isCI ? 2 : 0,
          benchmark: { include: [] },
          env: fixtureProjectEnv(entry),
        },
      })),
      ...rendererProjects,
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
          name: 'type-perf',
          include: ['packages/nuxt/test/typed-fetch-budget.test.ts'],
          // runs after the other projects rather than beside them
          sequence: { groupOrder: 1 },
          testTimeout: 300_000,
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
        plugins: [runtimeImportMeta({ dev: '(globalThis.__TEST_DEV__ ?? false)', server: '(globalThis.__TEST_SERVER__ ?? false)', test: '(globalThis.__TEST_TEST__ ?? false)', prerender: '(globalThis.__TEST_PRERENDER__ ?? false)' })],
        resolve: {
          alias: {
            '#build/nuxt.config.mjs': resolve('./test/mocks/nuxt-config'),
            '#build/router.options.mjs': resolve('./test/mocks/router-options'),
            '#build/route-rules.mjs': resolve('./test/mocks/route-rules'),
            '#app-manifest': resolve('./test/mocks/app-manifest'),
            '#build/pages': resolve('./test/mocks/pages'),
            '#build/routes': resolve('./test/mocks/routes'),
            '#internal/nuxt.config.mjs': resolve('./test/mocks/nitro-nuxt-config'),
            '#internal/nuxt/paths': resolve('./test/mocks/paths'),
            '#islands-v2-manifest': resolve('./test/mocks/islands-v2-manifest'),
            '#internal/nuxt/error-channel': resolve('./packages/nitro-server/src/runtime/utils/error-channel'),
            '#nuxt-compat/import-meta': resolve('./test/mocks/nitro-compat-import-meta'),
            '#nuxt-compat/flags': resolve('./test/mocks/nitro-compat-flags'),
            '#build/app.config.mjs': resolve('./test/mocks/app-config'),
            '#app': resolve('./packages/nuxt/src/app'),
          },
        },
        test: {
          name: 'unit',
          benchmark: { include: [] },
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-env.ts'],
          include: ['packages/**/*.{test,spec}.ts', 'scripts/*.test.ts'],
          testTimeout: isWindows ? 60000 : 10000,
          // Excluded plugin because it should throw an error when accidentally loaded via Nuxt
          exclude: [...fixtureExclude, 'packages/nuxt/test/typed-fetch-budget.test.ts'],
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
      await defineVitestProject({
        plugins: [runtimeImportMeta({ dev: '(globalThis.__TEST_DEV__ ?? false)' })],
        test: {
          name: 'nuxt',
          dir: './test/nuxt',
          exclude: [...defaultExclude, '**/universal/**', '**/dev/**'],
          environment: 'nuxt',
          globalSetup: ['./test/setup-prepare.ts'],
          setupFiles: ['./test/setup-runtime.ts'],
          environmentOptions: {
            nuxt: {
              overrides: commonSettings,
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
              overrides: commonSettings,
            },
          },
        },
      }),
    ],
  },
})
