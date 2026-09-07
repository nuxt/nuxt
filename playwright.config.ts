import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { isCI, isWindows } from 'std-env'
import type { MatrixOptions } from './test/e2e/test-utils'

type E2eConfigOptions = ConfigOptions & MatrixOptions

// dev-mode entries are interleaved to spread them across both Windows shards
const e2eMatrix = [
  { builder: 'webpack', isDev: false, nitroViteEnvironment: false },
  { builder: 'rspack', isDev: false, nitroViteEnvironment: false },
  { builder: 'vite', isDev: true, nitroViteEnvironment: false },
  { builder: 'vite', isDev: false, nitroViteEnvironment: false },
  { builder: 'vite', isDev: true, nitroViteEnvironment: true },
  { builder: 'vite', isDev: false, nitroViteEnvironment: true },
] as const

/**
 * `nitro-vite` is the vite builder with `experimental.nitroViteEnvironment`, not
 * a builder of its own. `withMatrix` keys the flag off `TEST_BUILDER`, so that
 * is the name the fixtures need to see, while `builder` stays `vite` for the
 * suites that gate on which bundler is in use.
 */
function testBuilderFor (entry: typeof e2eMatrix[number]) {
  return entry.nitroViteEnvironment ? 'nitro-vite' : entry.builder
}

const devOnlyTests = ['**/hmr.test.ts']
const builtOnlyTests = ['**/spa-preloader-*.test.ts', '**/server-page-css.test.ts', '**/chunk-error.test.ts', '**/no-scripts.test.ts']
const viteOnlyTests = ['**/server-page-css.test.ts', '**/no-scripts.test.ts']
const rspackExcludedTests = ['**/chunk-error.test.ts']

function testIgnoreForProject (entry: typeof e2eMatrix[number]) {
  const ignore: string[] = []
  if (entry.isDev) {
    ignore.push(...builtOnlyTests)
  } else {
    ignore.push(...devOnlyTests)
  }
  if (entry.builder !== 'vite') {
    ignore.push(...viteOnlyTests)
  }
  if (entry.builder === 'rspack') {
    ignore.push(...rspackExcludedTests)
  }
  return ignore
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
      const name = `e2e-${testBuilderFor(entry)}-${entry.isDev ? 'dev' : 'built'}`
      return {
        name,
        testIgnore: testIgnoreForProject(entry),
        fullyParallel: !entry.isDev && !isCI,
        use: {
          ...devices['Desktop Chrome'],
          isDev: entry.isDev,
          isBuilt: !entry.isDev,
          isWebpack: entry.builder === 'webpack' || entry.builder === 'rspack',
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
                  nitroViteEnvironment: entry.nitroViteEnvironment,
                },
              },
              env: {
                TEST_BUILDER: testBuilderFor(entry),
                TEST_ENV: entry.isDev ? 'dev' : 'built',
              },
            },
          },
        },
        dependencies: ['setup fixtures'],
      }
    }),
  ],
})
