import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'
import { isDev } from '../matrix'
import { isWindows } from 'std-env'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/lazy-hydration', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

if (isDev) {
  test.skip('Skipped: lazy hydration styles are skipped in dev mode', () => {})
} else {
  test.describe('lazy hydration styles', () => {
    test('should include CSS link for hydrate-never component when inlineStyles is false', async ({ page }) => {
      await page.goto('/')

      // Component HTML should be rendered
      await expect(page.locator('.hydrate-never-component')).toBeVisible()
      await expect(page.getByText('Hydrate Never')).toBeVisible()

      // CSS should be linked (not inlined, since inlineStyles: false)
      const styleLink = page.locator('link[rel="stylesheet"]').first()
      await expect(styleLink).toBeAttached()

      // The CSS file should contain our component styles
      const href = await styleLink.getAttribute('href')
      expect(href).toBeTruthy()

      const cssResponse = await page.request.get(href!)
      const css = await cssResponse.text()
      expect(css).toContain('.hydrate-never-component')
    })
  })
}
