import { expect, fixtureDir, test } from './test-utils'

test.use({
  nuxt: {
    rootDir: fixtureDir('server-page-css'),
  },
})

test.describe('server page CSS with inlineStyles false', () => {
  test('server page scoped CSS is inlined, including that of regular children', async ({ fetch }) => {
    const html = await fetch('/').then(r => r.text())

    expect(html).toContain('nuxt-only-shell')
    expect(html).toContain('nuxt-only-card')
    // the island handler inlines CSS regardless of `inlineStyles`
    expect(html).toContain('.nuxt-only-shell')

    expect(html).toContain('class="island-child"')
    expect(html).toContain('class="shared-child"')
    expect(html).toMatch(/\.island-child\[data-v-\w+\]\{/)
    expect(html).toMatch(/\.shared-child\[data-v-\w+\]\{/)
  })

  test('normal page CSS, including a component shared with a server component, is delivered via <link>', async ({ fetch }) => {
    const html = await fetch('/normal').then(r => r.text())
    expect(html).toContain('class="normal-shell')
    expect(html).toContain('class="shared-child')

    const hrefs = [...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    const css = (await Promise.all(hrefs.map(href => fetch(href).then(r => r.text())))).join('')
    expect(css).toContain('.normal-shell')
    expect(css).toContain('.shared-child')
  })
})
