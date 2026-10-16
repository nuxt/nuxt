import { isWindows } from 'std-env'
import type { Page } from '@playwright/test'
import { expect, test } from './test-utils'
import { useDevErrorFixture } from './dev-error-fixture'

const fixture = useDevErrorFixture('dev-error-recovery')

test.use({
  nuxt: {
    rootDir: fixture.fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe.configure({ mode: 'serial' })

test.afterEach(() => fixture.restore())

const overlayOf = (page: Page) => page.locator('nuxt-error-overlay')

function markPage (page: Page) {
  return page.evaluate(() => { (window as unknown as { __marker?: boolean }).__marker = true })
}

function pageIsMarked (page: Page) {
  return page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker === true)
}

const HEALTHY_PAGE = 'throw new Error(\'boom from a page\')\n'

test('renders the healthy page once an ssr runtime error is fixed, without a manual reload', async ({ page }) => {
  const healthy = fixture.read('app/pages/boom-page.vue')

  await page.goto('/boom-page')
  await expect(overlayOf(page)).toHaveCount(1)

  fixture.write('app/pages/boom-page.vue', healthy.replace(HEALTHY_PAGE, ''))
  await expect(page.locator('body')).toContainText('boom page healthy', { timeout: 30_000 })
})

test('reports the new position when the page throws on a different line', async ({ page }) => {
  const healthy = fixture.read('app/pages/boom-page.vue')
  const first = fixture.positionOf('app/pages/boom-page.vue', 'new Error')
  const loc = () => overlayOf(page).locator('.mb-loc').first()

  await page.goto('/boom-page')
  await expect(loc()).toContainText(`pages/boom-page.vue:${first.line}:${first.column}`)

  fixture.write('app/pages/boom-page.vue', healthy.replace('throw new Error', '\n\nthrow new Error'))
  await expect(loc()).toContainText(`pages/boom-page.vue:${first.line + 2}:${first.column}`, { timeout: 15_000 })
})

test('removes a client runtime overlay when the app navigates to a healthy route', async ({ page, goto }) => {
  await goto('/click-boom')
  await expect(overlayOf(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'throw' }).click()
  await expect(overlayOf(page)).toHaveCount(1)

  await page.getByRole('link', { name: 'to ok' }).click()
  await expect(page.locator('body')).toContainText('ok page')
  await expect(overlayOf(page)).toHaveCount(0, { timeout: 30_000 })
})

test('clears a click-handler overlay on the next update without reloading the page', async ({ page, goto }) => {
  await goto('/click-boom')
  await page.getByRole('button', { name: 'throw' }).click()
  await expect(overlayOf(page)).toHaveCount(1)

  await markPage(page)
  fixture.replace('app/pages/click-boom.vue', 'click boom healthy', 'click boom updated')

  await expect(overlayOf(page)).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('click boom updated')
  expect(await pageIsMarked(page)).toBe(true)
})

test('reloads the page when an error during hydration is fixed', async ({ page }) => {
  await page.goto('/hydration-boom')
  await expect(overlayOf(page)).toHaveCount(1, { timeout: 30_000 })

  await markPage(page)
  fixture.replace('app/pages/hydration-boom.vue', 'throw new Error(\'boom while hydrating\')', '')

  await expect(overlayOf(page)).toHaveCount(0, { timeout: 30_000 })
  await expect(page.locator('body')).toContainText('hydration boom healthy', { timeout: 30_000 })
  expect(await pageIsMarked(page)).toBe(false)
})

test('keeps an overlay over the error page when an unrelated file changes', async ({ page }) => {
  await page.goto('/boom-page')
  await expect(overlayOf(page)).toHaveCount(1)

  fixture.replace('app/pages/ok.vue', 'ok page', 'ok page updated')

  await expect(overlayOf(page)).toHaveCount(1, { timeout: 30_000 })
  await expect(overlayOf(page).locator('.mb-message')).toContainText('boom from a page', { timeout: 30_000 })
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
