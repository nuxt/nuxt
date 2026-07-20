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

async function findStylesheetHref (page: import('@playwright/test').Page, contains: string) {
  const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(l => (l as HTMLLinkElement).href))
  for (const href of hrefs) {
    const css = await (await page.request.get(href)).text()
    if (css.includes(contains)) { return href }
  }
}

test.describe('css cleanup on navigation (#22817)', () => {
  test('css from a previously visited layout does not leak into the current route', async ({ page, goto }) => {
    await goto('/')
    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)

    await page.click('a[href="/other"]')
    await expect(page.locator('.legacy-page')).toHaveCSS('color', RED)

    await page.click('a[href="/"]')
    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)

    // navigating forward again must restore the removed styles
    await page.click('a[href="/other"]')
    await expect(page.locator('.legacy-page')).toHaveCSS('color', RED)
  })

  test('removes (not just disables) the <link> for a stylesheet that is no longer active', async ({ page, goto }) => {
    await goto('/')

    await page.click('a[href="/other"]')
    await expect(page.locator('.legacy-page')).toHaveCSS('color', RED)
    const legacyHref = await findStylesheetHref(page, '.legacy-page')
    expect(legacyHref).toBeTruthy()

    await page.click('a[href="/"]')
    await expect(page.locator('.box')).toHaveCSS('border-top-color', BLUE)

    const hrefsAfterReturn = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(l => (l as HTMLLinkElement).href))
    expect(hrefsAfterReturn).not.toContain(legacyHref)
  })
})
