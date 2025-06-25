import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'

/**
 * This test suite verifies that Vue's runtime compiler works correctly within Nuxt,
 * testing various ways of using runtime-compiled components across multiple pages.
 */

const isWebpack = process.env.TEST_BUILDER === 'webpack' || process.env.TEST_BUILDER === 'rspack'
const isDev = process.env.TEST_ENV === 'dev'

const fixtureDir = fileURLToPath(new URL('../fixtures/basic', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      builder: isWebpack ? 'webpack' : 'vite',
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('composables', () => {
  /**
   * Tests that the overview page loads without errors
   */
  test('should handle parallel fetch execute with immediate: false and `experimental.alwaysRunFetchOnKeyChange: false`', async ({ page, goto }) => {
    await goto('/composables/fetch-immediate-false')
    await expect(page.getByTestId('status')).toHaveText('idle')

    const input = page.locator('[data-testid="query"]')
    await input.click()
    await input.fill('test')
    await expect(page.getByTestId('error')).toHaveText('')
    await expect(page.getByTestId('status')).toHaveText('success')
    expect(page).toHaveNoErrorsOrWarnings()
  })
})
