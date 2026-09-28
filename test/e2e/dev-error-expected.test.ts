import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

const fixtureDir = fileURLToPath(new URL('../fixtures-temp/dev-error-expected', import.meta.url))

test.use({
  nuxt: {
    rootDir: fixtureDir,
    dev: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    // both dev projects share this fixture and never write to it, but each needs its own dev server
    env: { NUXT_IGNORE_LOCK: '1' },
  },
})

test.describe.configure({ mode: 'serial' })

test('shows the error page with no overlay when a page throws an expected 404', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to expected 404' }).click()

  await expect(page.locator('body')).toContainText('custom error page: 404')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(0)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})

test('overlays the error page when a page throws a fatal 500', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to expected 500' }).click()

  await expect(page.locator('body')).toContainText('custom error page: 500')
  await expect(page.locator('nuxt-error-overlay')).toHaveCount(1)
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})

test('reports a thrown value that is not an error', async ({ page, goto }) => {
  await goto('/ok')
  await page.getByRole('link', { name: 'to teapot' }).click()

  const overlay = page.locator('nuxt-error-overlay')
  await expect(overlay).toHaveCount(1)
  await expect(overlay.locator('.mb-message')).toContainText('Thrown value')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
