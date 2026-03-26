import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { isCI, isWindows } from 'std-env'
import type { MatrixOptions } from './test/e2e/test-utils'

type E2eConfigOptions = ConfigOptions & MatrixOptions

const e2eMatrix = [
  { builder: 'vite' as const, isDev: true },
  { builder: 'vite' as const, isDev: false },
  { builder: 'rspack' as const, isDev: false },
  { builder: 'webpack' as const, isDev: false },
] as const

const devOnlyTests = ['**/hmr.test.ts']
const builtOnlyTests = ['**/spa-preloader-*.test.ts', '**/lazy-hydration.test.ts']
const viteOnlyTests = ['**/lazy-hydration.test.ts']

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
  reporter: 'html',
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
        use: {
          ...devices['Desktop Chrome'],
          isDev: entry.isDev,
          isBuilt: !entry.isDev,
          isWebpack: entry.builder === 'webpack' || entry.builder === 'rspack',
          builder: entry.builder,
          defaults: {
            nuxt: {
              dev: entry.isDev,
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
              },
            },
          },
        },
        dependencies: ['setup fixtures'],
      }
    }),
  ],
})
