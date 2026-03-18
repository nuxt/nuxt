import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

/**
 * This test suite verifies that Nuxt's suspense integration works correctly,
 * testing navigation between pages with suspense boundaries.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/suspense', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('Suspense multiple navigation', () => {
  test('should not throw error during multiple rapid navigation', async ({ page, goto }) => {
    // Navigate to the index page
    await goto('/')

    // Verify initial state
    await expect(page.getByTestId('btn-a')).toHaveText(' Target A ')

    // Navigate to target page using button A
    await page.getByTestId('btn-a').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/target')

    // Verify content after navigation
    await expect(page.getByTestId('content')).toContainText('Hello a')

    // Go back to index page
    await page.goBack()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')

    // Verify back at index page
    await expect(page.getByTestId('index-title')).toBeVisible()

    // Test multiple rapid navigation (clicking both buttons before first navigation completes)
    await Promise.all([
      page.getByTestId('btn-a').click(),
      page.getByTestId('btn-b').click(),
      page.getByTestId('btn-a').click(),
      page.getByTestId('btn-b').click(),
      page.getByTestId('btn-a').click(),
      page.getByTestId('btn-b').click(),
      page.getByTestId('btn-a').click(),
      page.getByTestId('btn-b').click(),
    ])

    // Verify we reached the target page with the correct content (from the second navigation)
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/target')
    await expect(page.getByTestId('content')).toContainText('Hello b')

    // Verify no errors or warnings occurred
    expect(page).toHaveNoErrorsOrWarnings()
  })
})
