import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

/**
 * Regression coverage for two interacting suspense bugs:
 *  - #34683: `await navigateTo()` from a page in layout A to a page in layout B
 *    leaves the URL updated but the DOM stuck on the old page.
 *  - #28425: rapid navigation between `useAsyncData`-bound pages within the same
 *    layout must not get stuck. Prior to the fix for #34683 a coarser gate would
 *    have re-introduced this regression for layout-wrapped apps.
 */

const fixtureDir = fileURLToPath(new URL('../fixtures/suspense-layout', import.meta.url))

test.describe.configure({ mode: 'serial' })

test.use({
  nuxt: {
    rootDir: fixtureDir,
    server: true,
    browser: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('Suspense navigation with layout change', () => {
  test('completes when redirect crosses layout boundary (#34683)', async ({ page, goto }) => {
    await goto('/')

    await expect(page.getByTestId('index-title')).toBeVisible()
    await expect(page.getByTestId('alternate-layout')).toBeVisible()

    await page.getByTestId('link-redirect').click()

    await expect(page.getByTestId('target-content')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()
    await expect(page.getByTestId('index-title')).not.toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('rapid navigation across useAsyncData pages settles on final route (#28425)', async ({ page, goto }) => {
    await goto('/asyncdata/p0')
    await expect(page.getByTestId('asyncdata-p0')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()

    await page.getByTestId('link-async-p1').dispatchEvent('click')
    await page.getByTestId('link-async-p2').dispatchEvent('click')
    await page.getByTestId('link-async-p3').dispatchEvent('click')

    await page.waitForFunction(() => window.useNuxtApp?.()._route.path === '/asyncdata/p3')
    await expect(page.getByTestId('asyncdata-p3')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('default-layout')).toBeVisible()

    expect(page).toHaveNoErrorsOrWarnings()
  })

  test('rapid cross-navigation while suspense is pending settles on final route (#35236)', async ({ page, goto }) => {
    await goto('/cross/a')

    await expect(page.getByTestId('cross-a')).toBeVisible({
      timeout: 10_000,
    })

    await page.getByTestId('link-cross-b').dispatchEvent('click')
    await page.getByTestId('link-cross-c').dispatchEvent('click')

    await page.waitForFunction(
      () => window.useNuxtApp?.()._route.path === '/cross/c',
    )

    await expect(page.getByTestId('cross-c')).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByTestId('cross-b')).toHaveCount(0)

    expect(page).toHaveNoErrorsOrWarnings()
  })
})
