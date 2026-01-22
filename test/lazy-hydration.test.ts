import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

await setup({
  rootDir: fileURLToPath(new URL('./fixtures/lazy-hydration', import.meta.url)),
  dev: false,
  server: true,
  browser: false,
})

describe('lazy hydration styles', () => {
  it('should include CSS link for hydrate-never component when inlineStyles is false', async () => {
    const html = await $fetch<string>('/')

    // Component HTML should be rendered
    expect(html).toContain('hydrate-never-component')
    expect(html).toContain('Hydrate Never')

    // CSS should be linked (not inlined, since inlineStyles: false)
    expect(html).toContain('<link rel="stylesheet"')

    // The CSS file should contain our component styles
    const cssMatch = html.match(/<link rel="stylesheet" href="([^"]+)"/)
    expect(cssMatch?.[1]).toBeTruthy()

    const css = await $fetch<string>(cssMatch![1]!)
    expect(css).toContain('.hydrate-never-component')
  })
})
