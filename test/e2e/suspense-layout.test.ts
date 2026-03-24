import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'

/**
 * This test verifies that navigation completes when a page redirects via
 * `await navigateTo()` across a layout boundary.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/suspense-layout', import.meta.url))

test.describe.configure({ mode: isDev ? 'serial' : 'parallel' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: isDev,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      buildDir: isDev ? join(fixtureDir, '.nuxt', 'test', Math.random().toString(36).slice(2, 8)) : undefined,
    },
  },
})

test.describe('Suspense navigation with layout change', () => {
  test('should complete navigation when redirect crosses layout boundary', async ({ page, goto }) => {
    await goto('/')

    await expect(page.getByTestId('home-title')).toBeVisible()
    await expect(page.getByTestId('alternate-layout')).toBeVisible()

    await page.getByTestId('btn-redirect').click()

    // Old page content should disappear after redirect across layout boundary
    await expect(page.getByTestId('home-title')).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('target-content')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })
})
