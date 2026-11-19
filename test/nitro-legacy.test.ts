import { describe, expect, it } from 'vitest'
import { $fetch, fetch } from '@nuxt/test-utils/e2e'

import { isDev, nitroViteEnvironment, runsOncePerViteBuilderInMatrix } from './matrix'
import { setupFixture } from './utils'

await setupFixture('nitro-legacy', runsOncePerViteBuilderInMatrix, { nuxtConfig: { experimental: { nitroViteEnvironment } } })

describe.skipIf(!runsOncePerViteBuilderInMatrix)('nitro v2 compatibility', () => {
  it('runs a v2-tagged module handler on nitro v3', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v2-module')).toMatchObject({
      flavour: 'earl-grey',
      secret: 'legacy-secret',
      hasNodeBridge: true,
      hasNitroContext: true,
      hasStorage: true,
    })
  })

  it('resolves `nitro/*` specifiers emitted into a module virtual module', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v3-module')).toMatchObject({
      hasCachedHandler: true,
      probe: 'specific-alias',
      nodeProbe: 'node-suffixed-alias',
    })
  })

  it('runs the variant this server prefers, of a route registered once per server API', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/variant?q=1')).toEqual({ variant: 'nuxt', query: '1' })
  })

  it('injects the v2 auto-imports into user server code', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/auto?q=1')).toMatchObject({
      flavour: 'earl-grey',
      fromQuery: '1',
    })
  })

  it('serialises `createError` from a v2-tagged module handler with the v2 keys', async () => {
    const error = await $fetch<Record<string, unknown>>('/api/v2-module?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({
      statusCode: 418,
      statusMessage: 'I am a teapot',
      data: { from: 'v2-module' },
    })
  })

  it('serves a JSON file imported from a dependency', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/dependency-json')).toEqual({ name: 'typescript' })
  })

  it('runs a v1-style user handler with `nitroLegacy` enabled', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v2-user')).toMatchObject({
      flavour: 'mutated-per-request',
      sharedFlavour: 'earl-grey',
      hasNodeBridge: true,
    })
  })

  it('registers user server files with a dotted suffix in their names', async () => {
    const response = await fetch('/.well-known/site.standard.publication')
    expect(response.status).toBe(200)
    expect(response.headers.get('x-stamp')).toBe('yes')
    expect(await response.text()).toBe('at://did:example/site.standard.publication/1')
  })

  it('serialises `createError` from a user handler with the v2 keys', async () => {
    const error = await $fetch<Record<string, unknown>>('/api/v2-user?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({ statusCode: 422, statusMessage: 'Unprocessable', data: { from: 'user' } })
  })

  it('applies `headers` route rules over the headers a handler sets', async () => {
    for (const route of ['/api/rule-headers/me', '/api/rule-headers/response']) {
      expect((await fetch(route)).headers.get('cache-control')).toBe('public, max-age=60')
    }
    expect((await fetch('/api/rule-headers/ctype')).headers.get('content-type')).toBe('application/x-from-rule')
  })

  it('sends the `no-store` of a route rule with errors', async () => {
    const bodies: unknown[] = []
    for (const route of ['/api/no-store/thrown', '/api/no-store/module', '/api/no-store/returned']) {
      const response = await fetch(route, { headers: { accept: 'application/json' } })
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toBe('no-store')
      bodies.push(await response.json())
    }
    expect(bodies[0]).not.toEqual({ status: 401 })
    expect(bodies[1]).toEqual({ status: 401 })
    expect(bodies[2]).toEqual({ returned: true })
  })

  it('answers a v1-style handler that returns `null` with no content', async () => {
    const response = await fetch('/api/null')
    expect(response.status).toBe(204)
    expect(response.headers.has('content-type')).toBe(false)
    expect(await response.text()).toBe('')

    const accepted = await fetch('/api/null?status=1')
    expect(accepted.status).toBe(202)
    expect(accepted.headers.has('content-type')).toBe(false)

    expect(await $fetch('/api/null?fetch=1')).toEqual({ value: 'undefined' })

    for (const route of ['/api/cached-null', '/api/cached-null-auto']) {
      for (let i = 0; i < 2; i++) {
        const cached = await fetch(route)
        expect(cached.status).toBe(204)
        expect(cached.headers.has('content-type')).toBe(false)
      }
    }
  })

  it.skipIf(isDev)('ships to the server what the prerenderer stored and a build hook read back from `nitro.storage`', async () => {
    const { mounts, prerendered } = await $fetch<{ mounts: string[], prerendered: unknown }>('/api/storage')
    expect(prerendered).toEqual(['/prerendered'])
    expect(mounts).not.toEqual(expect.arrayContaining([expect.stringMatching(/^(?:build|cache|data|root|src):$/)]))
  })

  it.skipIf(!isDev)('mounts the Nitro v2 storage in development', async () => {
    const { mounts } = await $fetch<{ mounts: string[] }>('/api/storage')
    expect(mounts).toEqual(expect.arrayContaining(['build:', 'cache:', 'data:', 'root:', 'src:']))
  })

  it('gives in-process requests the socket a v1 middleware reads', async () => {
    expect(await $fetch('/socket')).toContain('in-process: true')
    expect(await $fetch('/api/socket?sub=1')).toEqual({ inProcess: true })

    const response = await fetch('/missing', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(404)
  })

  it('responds to a preflight request a v1 `handleCors` middleware handles, for a method-specific route', async () => {
    const response = await fetch('/api/item', {
      method: 'OPTIONS',
      headers: { 'origin': 'https://app.example', 'access-control-request-method': 'POST' },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET,POST')

    expect(await $fetch('/api/item', { method: 'POST', body: { name: 'nuxt' } })).toEqual({ received: { name: 'nuxt' } })
  })

  it('rejects a v1 body read of a GET request with `405`', async () => {
    const response = await fetch('/api/body')
    expect(response.status).toBe(405)
    expect(await response.json()).toMatchObject({ statusCode: 405, statusMessage: 'HTTP method is not allowed.' })
  })

  it('resolves an alias of `h3` in module code to h3 v2 when a module pins `h3` to h3 v1', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/aliased-h3?q=1')).toEqual({ query: { q: '1' }, h3v2: true })
  })

  it('responds with the redirect a v2 `render:before` listener sets, instead of rendering the page', async () => {
    const response = await fetch('/render-before', { headers: { accept: 'text/html' }, redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/fr')
    expect(response.headers.getSetCookie()).toEqual([expect.stringMatching(/^locale=fr;/)])
    expect(response.headers.get('x-render-response')).toBe('applied')
    expect(await response.text()).toContain('url=/fr')
  })

  it('responds with the web `Response` a v2 `render:before` listener sets as the body', async () => {
    const response = await fetch('/render-before-response', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(203)
    expect(response.headers.get('x-from')).toBe('response')
    expect(await response.text()).toBe('from a web response')
  })

  it('responds with an error to the error a v2 `render:before` listener sets as the body', async () => {
    for (const accept of ['text/html', 'application/json']) {
      const response = await fetch('/render-before-error', { headers: { accept } })
      expect(response.status).toBe(418)
      expect(response.statusText).toBe('Teapot')
    }
  })

  it('keeps the status of an error page unless a v2 `render:response` listener sets one', async () => {
    for (const accept of ['text/html', 'application/json']) {
      const response = await fetch('/missing', { headers: { accept } })
      expect(response.status).toBe(404)
      expect(response.headers.get('x-render-response')).toBe('applied')
    }

    const response = await fetch('/missing?status=410', { headers: { accept: 'text/html' } })
    expect(response.status).toBe(410)
    expect(response.statusText).toBe('From render:response')
  })
})
