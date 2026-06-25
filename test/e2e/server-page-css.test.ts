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
  test('server page scoped CSS is delivered', async ({ fetch, isBuilt }) => {
    const res = await fetch('/')
    const html = await res.text()

    // Server page HTML should contain scoped class names
    expect(html).toContain('nuxt-only-shell')
    expect(html).toContain('nuxt-only-card')

    if (isBuilt) {
      // The island handler inlines the server page's scoped CSS as a <style> tag,
      // regardless of the inlineStyles setting
      expect(html).toContain('.nuxt-only-shell')
    } else {
      // In dev there is no built styles manifest, so the scoped CSS is delivered
      // via a vite module <link> instead of being inlined
      expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+pages\/index\.server\.vue[^>]+scoped/)
    }
  })

  test('normal page scoped CSS is delivered', async ({ page, isBuilt }) => {
    await page.goto('/normal')

    // Normal page should be visible
    await expect(page.locator('.normal-shell')).toBeVisible()

    if (isBuilt) {
      // CSS is delivered via <link> (not inlined, since inlineStyles: false)
      const styleLinks = page.locator('link[rel="stylesheet"]')
      const count = await styleLinks.count()
      expect(count).toBeGreaterThan(0)

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
    } else {
      // In dev the vite client injects the active route's scoped CSS as a <style>
      // tag during hydration, replacing the server-rendered <link>
      const padding = await page.locator('.normal-shell').evaluate(el => getComputedStyle(el).padding)
      expect(padding).toBe('32px')
    }
  })
})
