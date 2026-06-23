import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'
import { isWindows } from 'std-env'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/server-page-css', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('server page CSS with inlineStyles false', () => {
  test('server page scoped CSS is delivered', async ({ fetch }) => {
    const res = await fetch('/')
    const html = await res.text()

    // Server page HTML should contain scoped class names
    expect(html).toContain('nuxt-only-shell')
    expect(html).toContain('nuxt-only-card')

    // The island handler always inlines CSS as <style> tags,
    // regardless of the inlineStyles setting
    expect(html).toContain('.nuxt-only-shell')
  })

  test('normal page scoped CSS is delivered via <link>', async ({ page }) => {
    await page.goto('/normal')

    // Normal page should be visible
    await expect(page.locator('.normal-shell')).toBeVisible()

    // CSS should be linked (not inlined, since inlineStyles: false)
    const styleLinks = page.locator('link[rel="stylesheet"]')
    const count = await styleLinks.count()
    expect(count).toBeGreaterThan(0)

    // Find the CSS file containing our normal page styles
    let found = false
    for (let i = 0; i < count; i++) {
      const href = await styleLinks.nth(i).getAttribute('href')
      if (!href) { continue }
      const cssRes = await page.request.get(href)
      const css = await cssRes.text()
      if (css.includes('.normal-shell')) {
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})
