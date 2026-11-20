import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, nitroMajor, runsOncePerEnvInMatrix } from './matrix'

// the fixture depends on `nitro`, which is what selects the nitro v3 server builder
const shouldRun = runsOncePerEnvInMatrix && nitroMajor !== 2

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/nitro-v3', import.meta.url)),
    server: true,
    browser: false,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('nitro v3 server builder', () => {
  it('serves a handler written against `nuxt/server`', async () => {
    expect(await $fetch('/api/portable?a=1')).toEqual({ method: 'GET', path: '/api/portable', query: { a: '1' } })
  })

  it('serves a handler written against nitro v2 through the compatibility layer', async () => {
    expect(await $fetch('/api/legacy?a=1')).toEqual({ method: 'GET', path: '/api/legacy?a=1', query: { a: '1' } })
  })

  it('registers the nitro v3 variant of a module handler', async () => {
    expect(await $fetch('/api/variant')).toEqual({ api: 'nitro3', path: '/api/variant' })
  })

  it('runs a module handler that only has a nitro v2 variant', async () => {
    expect(await $fetch('/api/variant-nitro2')).toEqual({ api: 'nitro2', path: '/api/variant-nitro2' })
  })

  it('renders a page and passes the response to a nitro v2 `render:response` listener', async () => {
    const response = await fetch('/')
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('x-legacy-plugin')).toBe('yes')
    expect(response.headers.getSetCookie()).toEqual(['from-page=yes; Path=/'])
    expect(html).toContain('&quot;path&quot;: &quot;/api/portable&quot;')
    expect(html).toContain('&quot;path&quot;: &quot;/api/legacy&quot;')
  })

  it('renders a route ruled `ssr: false` as an empty shell', async () => {
    const html = await $fetch<string>('/spa')
    expect(html).toContain('data-ssr="false"')
    expect(html).not.toContain('spa page')
  })

  it('passes `useFetch` `params` through to the query string', async () => {
    const html = await $fetch<string>('/params')
    expect(html).toContain('query-value')
  })

  it('keeps the status of an error thrown while rendering a page', async () => {
    const page = await fetch('/missing', { headers: { accept: 'text/html' } })
    expect(page.status).toBe(404)
    expect(page.headers.get('content-type')).toContain('text/html')

    const json = await fetch('/missing', { headers: { accept: 'application/json' } })
    expect(json.status).toBe(404)
    expect(await json.json()).toMatchObject({ status: 404, statusText: 'Page Not Found' })
  })

  it.skipIf(isDev)('should not let a missing build asset be cached', async () => {
    const res = await fetch('/_nuxt/missing-chunk.js')
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('should not let an error from a cached route be cached', async () => {
    const counts: number[] = []
    for (let i = 0; i < 2; i++) {
      const res = await fetch('/api/cached-error', { headers: { accept: 'application/json' } })
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-cache')
      counts.push((await res.json()).data.count)
    }
    expect(counts[1]).toBe(counts[0]! + 1)
  })

  it('should not let a page error be cached', async () => {
    for (const accept of ['text/html', 'application/json']) {
      const res = await fetch('/error/not-found', { headers: { accept } })
      expect(res.status).toBe(404)
      expect(res.headers.get('cache-control')).toBe('no-cache')
    }
  })

  it('should not let a page error outside a route rule be cached', async () => {
    for (const accept of ['text/html', 'application/json']) {
      const res = await fetch('/page-that-does-not-exist', { headers: { accept } })
      expect([res.status, res.headers.get('cache-control')]).toEqual([404, 'no-cache'])
    }
  })

  it('should keep the route rule cache-control on an error response a handler returns', async () => {
    const res = await fetch('/api/returned-error')
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBe('public, max-age=60')
  })
})
