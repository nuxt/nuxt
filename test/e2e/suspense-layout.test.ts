import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { join } from 'pathe'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'

/**
 * Regression coverage for two interacting suspense bugs:
 *  - #34683: `await navigateTo()` from a page in layout A to a page in layout B
 *    leaves the URL updated but the DOM stuck on the old page.
 *  - #28425: rapid navigation between `useAsyncData`-bound pages within the same
 *    layout must not get stuck. Prior to the fix for #34683 a coarser gate would
 *    have re-introduced this regression for layout-wrapped apps.
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
})
