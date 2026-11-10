import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { isCI, isWindows } from 'std-env'
import type { MatrixOptions } from './test/e2e/test-utils'

type E2eConfigOptions = ConfigOptions & MatrixOptions

// dev-mode tests are placed third to spread them across both Windows shards
const e2eMatrix = [
  { builder: 'webpack', isDev: false },
  { builder: 'rspack', isDev: false },
  { builder: 'vite', isDev: true },
  { builder: 'vite', isDev: false },
] as const

const devOnlyTests = ['hmr', 'dev-error-*']
const builtOnlyTests = ['spa-preloader-*', 'server-page-css', 'chunk-error', 'no-scripts*']
const viteOnlyTests = ['server-page-css', 'no-scripts*', 'dev-error-*']
/** Suites of client runtime behaviour, which does not depend on the builder. */
const runtimeTests = ['nested-suspense', 'navigation-repaint', 'nuxt-time', 'preview', 'server-path-fallback', 'spa-preloader-*', 'suspense', 'ui-templates']
/**
 * The chunk error runtime module is only applied with webpack, and vue-loader compiles vapor
 * SFCs as vdom components, which the webpack project already covers.
 */
const rspackExcludedTests = ['chunk-error', 'vapor']

function testIgnoreForProject (entry: typeof e2eMatrix[number]) {
  const isVite = entry.builder === 'vite'
  return [
    ...entry.isDev ? builtOnlyTests : devOnlyTests,
    ...isVite ? [] : [...viteOnlyTests, ...runtimeTests],
    ...entry.builder === 'rspack' ? rspackExcludedTests : [],
  ].map(name => `**/${name}.test.ts`)
}

/**
 * Playwright configuration for Nuxt e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig<E2eConfigOptions>({
  testDir: './test/e2e',
  testMatch: '**/*.test.ts',
  timeout: (isWindows ? 360 : 120) * 1000,
  fullyParallel: !isCI,
  forbidOnly: !!isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['html'],
    ['@flakiness/playwright', { flakinessProject: 'nuxt/nuxt' }],
  ],
  projects: [
    {
      name: 'setup fixtures',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup fixtures',
    },
    {
      name: 'cleanup fixtures',
      testMatch: /global\.teardown\.ts/,
    },
    ...e2eMatrix.map((entry) => {
      const name = `e2e-${entry.builder}-${entry.isDev ? 'dev' : 'built'}`
      return {
        name,
        testIgnore: testIgnoreForProject(entry),
        fullyParallel: !entry.isDev && !isCI,
        use: {
          ...devices['Desktop Chrome'],
          isDev: entry.isDev,
          builder: entry.builder,
          defaults: {
            nuxt: {
              dev: entry.isDev,
              setupTimeout: (isWindows ? 360 : 120) * 1000,
              serverStartTimeout: (isWindows ? 300 : 120) * 1000,
              nuxtConfig: {
                builder: entry.builder,
                devtools: { enabled: false },
                experimental: {
                  appManifest: true,
                },
              },
              env: {
                TEST_BUILDER: entry.builder,
                TEST_ENV: entry.isDev ? 'dev' : 'built',
                // dev projects share fixture directories, and each runs its own dev server
                ...entry.isDev ? { NUXT_IGNORE_LOCK: '1' } : {},
              },
            },
          },
        },
        dependencies: ['setup fixtures'],
      }
    }),
  ],
})
