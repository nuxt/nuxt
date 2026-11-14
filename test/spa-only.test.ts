import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'
import { setupFixture } from './utils'

// Stubbing a page out of the server bundle leaves its route record in place, so
// every route it touches still has to resolve.

await setupFixture('spa-only', runsOncePerEnvInMatrix)

describe.skipIf(!runsOncePerEnvInMatrix)('pages served with `ssr: false`', () => {
  it('serves an SPA shell rather than rendered markup', async () => {
    const html = await $fetch<string>('/admin')
    expect(html).not.toContain('admin-index-page')
    expect(html).toContain('<div id="__nuxt">')
  })

  it('serves a client-only dynamic route', async () => {
    const html = await $fetch<string>('/products/123')
    expect(html).not.toContain('product-page')
    expect(html).toContain('<div id="__nuxt">')
  })

  it('still renders a more specific `ssr: true` route and its parent shell', async () => {
    const html = await $fetch<string>('/admin/ssr')
    expect(html).toContain('admin-ssr-page')
    expect(html).toContain('admin-shell')
  })

  it('still renders a server-rendered alias of a client-only page', async () => {
    expect(await $fetch<string>('/aliased-alt')).toContain('aliased-page')
    expect(await $fetch<string>('/aliased')).not.toContain('aliased-page')
  })

  it.skipIf(isDev).each([
    // the layout of a parent route applies to the routes nested in it
    ['/admin', ['admin-shell', 'admin-index-page', 'fixture-panel-layout'], ['product-page', 'report-default', 'fixture-default-layout']],
    ['/products/123', ['product-page', 'fixture-default-layout'], ['admin-shell', 'report-default', 'fixture-panel-layout']],
    // a page with `layout: false` renders in no layout
    ['/report', ['report-default', 'report-aux'], ['admin-shell', 'product-page', 'fixture-default-layout', 'fixture-panel-layout']],
  ])('preloads only the page and layout chunks of %s', async (path, markers, unrelatedMarkers) => {
    const html = await $fetch<string>(path)
    const preloaded = await Promise.all([...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => $fetch<string>(m[1]!, { responseType: 'text' })))
    for (const marker of markers) {
      expect(preloaded.some(code => code.includes(marker)), marker).toBe(true)
    }
    for (const marker of unrelatedMarkers) {
      expect(preloaded.some(code => code.includes(marker)), marker).toBe(false)
    }
  })

  it.skipIf(isDev)('preloads the styles of a client-only page without applying them', async () => {
    const html = await $fetch<string>('/products/123')
    const preloads = [...html.matchAll(/<link rel="preload" as="style"[^>]*href="([^"]+)"/g)].map(m => m[1]!)
    const styles = await Promise.all(preloads.map(href => $fetch<string>(href, { responseType: 'text' })))
    const preload = preloads[styles.findIndex(css => css.includes('client-only-style'))]
    expect(preload).toBeDefined()
    expect([...html.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1])).not.toContain(preload)
  })

  it('still renders a child that escapes its parent region via an absolute path', async () => {
    const html = await $fetch<string>('/escaped')
    expect(html).toContain('escaped-page')
    expect(html).toContain('parent-shell')
  })
})
