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
    const btnA = page.getByTestId('btn-a')
    const btnB = page.getByTestId('btn-b')
    await btnA.dispatchEvent('click')
    await btnB.dispatchEvent('click')
    await btnA.dispatchEvent('click')
    await btnB.dispatchEvent('click')
    await btnA.dispatchEvent('click')
    await btnB.dispatchEvent('click')
    await btnA.dispatchEvent('click')
    await btnB.dispatchEvent('click')

    // Verify we reached the target page with the correct content (from the second navigation)
    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/target')
    await expect(page.getByTestId('content')).toContainText('Hello b', { timeout: 10_000 })

    // Verify no errors or warnings occurred
    expect(page).toHaveNoErrorsOrWarnings()
  })

  // https://github.com/nuxt/nuxt/issues/23232
  // visit a 3-level-deep route, navigate back one level, then jump to a top-level async page.
  // 1. plain (root is Suspense)
  // 2. with `keepalive` (root is KeepAlive)
  // 3. with `transition` (root is Transition).
  // in each case the inner <NuxtPage> caches a Suspense vnode whose boundary has already
  // been unmounted.
  for (const variant of [
    { name: 'plain', query: '' },
    { name: 'with keepalive', query: '?ka=1' },
    { name: 'with transition', query: '?tr=1' },
  ] as const) {
    test(`should not throw when navigating from a deeply nested route to an async page (${variant.name})`, async ({ page, goto }) => {
      await goto(`/${variant.query}`)
      await expect(page.getByTestId('index-title')).toBeVisible()

      await page.getByTestId('link-project').click()
      await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/setting/project')
      await expect(page.getByTestId('project-title')).toBeVisible()

      await page.getByTestId('link-create').click()
      await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/setting/project/create')
      await expect(page.getByTestId('create-title')).toBeVisible()

      await page.getByTestId('link-back-project').click()
      await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/setting/project')
      await expect(page.getByTestId('project-title')).toBeVisible()

      await page.getByTestId('nav-link-waiting').click()
      await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/waiting')
      await expect(page.getByTestId('waiting-title')).toBeVisible()

      expect(page).toHaveNoErrorsOrWarnings()
    })
  }
})
