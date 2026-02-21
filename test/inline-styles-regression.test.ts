import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { $fetch, createTest, setTestContext } from '@nuxt/test-utils/e2e'

import { isDev, isWebpack } from './matrix'

function registerHooks (hooks: ReturnType<typeof createTest>) {
  beforeAll(async () => {
    setTestContext(hooks.ctx)
    await hooks.beforeAll()
    setTestContext(undefined)
  }, hooks.ctx.options.setupTimeout)

  beforeEach(() => {
    hooks.beforeEach()
  })

  afterEach(() => {
    hooks.afterEach()
  })

  afterAll(async () => {
    setTestContext(hooks.ctx)
    await hooks.afterAll()
    setTestContext(undefined)
  }, hooks.ctx.options.teardownTimeout)
}

describe.skipIf(isDev || isWebpack)('inlineStyles dedupe (safe case)', () => {
  const test = createTest({
    rootDir: fileURLToPath(new URL('./fixtures/inline-styles-dedupe', import.meta.url)),
    browser: false,
  })

  registerHooks(test)

  it('inlines component CSS and does not link entry CSS', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('--inline-dedupe-token')

    const cssLinks = [...html.matchAll(/<link [^>]*href="([^"]*\.css)"/g)].map(m => m[1]!)
    expect(cssLinks).toHaveLength(0)
  })
})

describe.skipIf(isDev || isWebpack)('inlineStyles dedupe (mixed case)', () => {
  const test = createTest({
    rootDir: fileURLToPath(new URL('./fixtures/inline-styles-mixed', import.meta.url)),
    browser: false,
  })

  registerHooks(test)

  it('keeps non-inlineable CSS in linked CSS files', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('--inline-mixed-token')

    const cssLinks = [...new Set([...html.matchAll(/<link [^>]*href="([^"]*\.css)"/g)].map(m => m[1]!))]
    expect(cssLinks.length).toBeGreaterThan(0)

    let linkedCSS = ''
    for (const file of cssLinks) {
      linkedCSS += await $fetch<string>(file)
    }

    expect(linkedCSS).toContain('--plugin-css-token')
  })
})
