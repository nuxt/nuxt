import { fileURLToPath } from 'node:url'
import { isWindows } from 'std-env'
import { expect, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/css-cleanup', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

const BLUE = 'rgb(0, 0, 255)'
const RED = 'rgb(255, 0, 0)'

test.describe('css cleanup on navigation (#22817)', () => {
  test('css from a previously visited layout does not leak into the current route', async ({ page, goto }) => {
    await goto('/')
    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)

    await page.click('a[href="/other"]')
    await expect(page.locator('.legacy-page')).toHaveCSS('color', RED)

    await page.click('a[href="/"]')
    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)

    // navigating forward again must restore the disabled styles
    await page.click('a[href="/other"]')
    await expect(page.locator('.legacy-page')).toHaveCSS('color', RED)
  })

  test('prefetching a link does not apply css from the unvisited route', async ({ page, goto }) => {
    // resolves once the legacy layout's css chunk has been fetched (triggered by NuxtLink prefetch)
    const legacyCssFetched = page.waitForResponse(async response =>
      response.url().includes('.css') && (await response.text().catch(() => '')).includes('red'), { timeout: 15_000 },
    ).catch(() => null)

    await goto('/prefetch')
    await legacyCssFetched

    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)
  })
})
