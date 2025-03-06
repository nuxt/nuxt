import { defineConfig, devices } from '@playwright/test'
import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { isCI, isWindows } from 'std-env'

/**
 * Playwright configuration for Nuxt e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig<ConfigOptions>({
  testDir: './test/e2e',
  testMatch: '**/*.test.ts',
  timeout: (isWindows ? 360 : 120) * 1000,
  fullyParallel: true,
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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup fixtures'],
    },
  ],
})
