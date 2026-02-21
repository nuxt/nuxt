import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, isWebpack } from './matrix'

if (!isDev && !isWebpack) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    dev: isDev,
    server: true,
    browser: false,
    nuxtConfig: {
      css: [],
      features: {
        inlineStyles: id => !!id && id.includes('.vue'),
      },
      hooks: {
        'modules:done' () {
          process.env.NODE_ENV = 'production'
        },
        ready (nuxt) {
          nuxt.options.css = []
        },
      },
      ignore: ['**/plugins/style.ts'],
    },
  })
}

describe.skipIf(isDev || isWebpack)('inlineStyles dedupe regression (basic fixture)', () => {
  it('inlines component CSS and does not link entry CSS when no non-inlineable CSS is present', async () => {
    const html = await $fetch<string>('/inline-styles-regression')
    expect(html).toContain('--inline-regression-token')
    const cssLinks = [...html.matchAll(/<link [^>]*href="([^"]*entry[^"]*\.css)"/g)].map(m => m[1]!)
    expect(cssLinks).toHaveLength(0)
  })
})
