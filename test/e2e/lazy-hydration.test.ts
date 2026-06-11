import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'
import { isWindows } from 'std-env'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/lazy-hydration', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

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

  // https://github.com/nuxt/nuxt/issues/35145
  test.fail('should not preload JS chunk for hydrate-on-visible component', async ({ page }) => {
    await page.goto('/')

    const links = await page.locator('link').all()
    for (const link of links) {
      if (await link.getAttribute('rel') !== 'modulepreload') { continue }
      const href = await link.getAttribute('href')
      if (!href) { continue }
      const js = await page.request.get(href).then(r => r.text())
      expect(js).not.toContain('hydrate-on-visible-component')
    }
  })
})
