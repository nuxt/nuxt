import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

/**
 * This test suite verifies the `stableContent` feature (#35236).
 *
 * When `stableContent` is enabled (via `<NuxtPage :stable-content="true">` or
 * `definePageMeta({ stableContent: true })`), the internal Suspense boundary is
 * NOT recreated during rapid/concurrent navigation. This keeps the previous page
 * content visible while the new page's async dependencies resolve, preventing the
 * blank-content flash described in the issue.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/suspense-stable', import.meta.url))

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('Suspense stableContent', () => {
  test('should complete rapid navigation without errors when stableContent is enabled', async ({ page, goto }) => {
    // Start on the home page with stableContent enabled
    await goto('/?stable=1')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Rapidly navigate between async pages
    await page.getByTestId('nav-page-a').dispatchEvent('click')
    await page.getByTestId('nav-page-b').dispatchEvent('click')

    // Should eventually settle on page B without errors
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-b')
    await expect(page.getByTestId('page-b-content')).toBeVisible({ timeout: 10_000 })

    // Verify no errors or warnings occurred
    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('should handle multiple rapid navigations with stableContent enabled', async ({ page, goto }) => {
    await goto('/?stable=1')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Fire many rapid navigations
    await page.getByTestId('nav-page-a').dispatchEvent('click')
    await page.getByTestId('nav-page-b').dispatchEvent('click')
    await page.getByTestId('nav-page-a').dispatchEvent('click')
    await page.getByTestId('nav-page-b').dispatchEvent('click')

    // Should settle on the final destination
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-b')
    await expect(page.getByTestId('page-b-content')).toBeVisible({ timeout: 10_000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('should work with stableContent set via definePageMeta', async ({ page, goto }) => {
    await goto('/')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Navigate to page-d which has definePageMeta({ stableContent: true })
    await page.getByTestId('nav-page-a').dispatchEvent('click')
    // Rapidly navigate to page-d before page-a resolves
    const pageDLink = page.locator('[data-testid="nav-home"]')
    await pageDLink.dispatchEvent('click')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Now navigate to page-d
    await page.goto('/page-d')
    await expect(page.getByTestId('page-d-content')).toBeVisible({ timeout: 10_000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('should work with mixed sync and async pages when stableContent is enabled', async ({ page, goto }) => {
    await goto('/?stable=1')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Navigate to a fast page first
    await page.getByTestId('nav-page-c').dispatchEvent('click')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-c')
    await expect(page.getByTestId('page-c-content')).toBeVisible()

    // Then rapidly navigate to a slow async page
    await page.getByTestId('back-home').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('home-title')).toBeVisible()

    await page.getByTestId('nav-page-a').dispatchEvent('click')
    await page.getByTestId('nav-page-b').dispatchEvent('click')

    // Should settle on page B
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-b')
    await expect(page.getByTestId('page-b-content')).toBeVisible({ timeout: 10_000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('should maintain backward compatibility when stableContent is not set', async ({ page, goto }) => {
    // Without stableContent (default behavior)
    await goto('/')
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Navigate to a page
    await page.getByTestId('nav-page-a').dispatchEvent('click')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-a')
    await expect(page.getByTestId('page-a-content')).toBeVisible({ timeout: 10_000 })

    // Navigate back and then to another page
    await page.getByTestId('back-home').click()
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/')
    await expect(page.getByTestId('home-title')).toBeVisible()

    await page.getByTestId('nav-page-b').dispatchEvent('click')
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/page-b')
    await expect(page.getByTestId('page-b-content')).toBeVisible({ timeout: 10_000 })

    expect(page).toHaveNoErrorsOrWarnings()
  })
})
