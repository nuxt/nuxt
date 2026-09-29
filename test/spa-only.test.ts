import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

// Stubbing a page out of the server bundle leaves its route record in place, so
// every route it touches still has to resolve.
const shouldRun = runsOncePerEnvInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/spa-only', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('pages served with `ssr: false`', () => {
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

  it('still renders a child that escapes its parent region via an absolute path', async () => {
    const html = await $fetch<string>('/escaped')
    expect(html).toContain('escaped-page')
    expect(html).toContain('parent-shell')
  })
})
