import { pageStyles } from './no-scripts-page-styles'
import { expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('no-scripts'),
    nuxtConfig: {
      features: {
        inlineStyles: false,
      },
    },
  },
})

test.describe('noScripts route rules without inline styles', () => {
  test('inlines every style source of the page', async ({ fetch }) => {
    const html = await (await fetch('/no-scripts')).text()

    for (const style of Object.values(pageStyles)) {
      expect(html).toMatch(style)
    }

    expect(html).not.toContain('type="module"')
    expect(html).not.toContain('__NUXT_DATA__')
  })

  test('keeps the stylesheet a scripted route relies on', async ({ fetch }) => {
    const html = await (await fetch('/')).text()

    expect(html).toContain('type="module"')
    expect(html).not.toMatch(pageStyles.sharedComponent)

    const hrefs = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    expect(hrefs.length).toBeGreaterThan(0)

    const css = (await Promise.all(hrefs.map(async href => (await fetch(href)).text()))).join('')
    expect(css).toMatch(pageStyles.sharedComponent)
  })
})
