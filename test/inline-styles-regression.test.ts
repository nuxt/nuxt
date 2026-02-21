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
      features: {
        inlineStyles: id => !!id && (id.includes('.vue') || id.includes('entry')),
      },
      hooks: {
        'modules:done' () {
          process.env.NODE_ENV = 'production'
        },
      },
      ignore: ['**/plugins/style.ts'],
    },
  })
}

describe.skipIf(isDev || isWebpack)('inlineStyles dedupe regression (basic fixture)', () => {
  it('does not keep entry CSS link when function-based inlining includes entry and vue styles', async () => {
    const html = await $fetch<string>('/inline-styles-regression')
    expect(html).toContain('--global:"global";')
    expect(html).toContain('--inline-regression-token')
    const cssLinks = [...html.matchAll(/<link [^>]*href="([^"]*entry[^"]*\.css)"/g)].map(m => m[1]!)
    expect(cssLinks).toHaveLength(0)
  })
})
