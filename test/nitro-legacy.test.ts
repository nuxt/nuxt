import { describe, expect, it } from 'vitest'
import { $fetch, fetch } from '@nuxt/test-utils/e2e'

import { runsOncePerEnvInMatrix } from './matrix'
import { setupFixture } from './utils'

await setupFixture('nitro-legacy', runsOncePerEnvInMatrix)

describe.skipIf(!runsOncePerEnvInMatrix)('nitro v2 compatibility', () => {
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

  it('runs a v1-style user handler with `nitroLegacy` enabled', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/v2-user')).toMatchObject({
      flavour: 'mutated-per-request',
      sharedFlavour: 'earl-grey',
      hasNodeBridge: true,
    })
  })

  it('serialises `createError` from a user handler with the v2 keys', async () => {
    const error = await $fetch<Record<string, unknown>>('/api/v2-user?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({ statusCode: 422, statusMessage: 'Unprocessable', data: { from: 'user' } })
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

    for (let i = 0; i < 2; i++) {
      const cached = await fetch('/api/cached-null')
      expect(cached.status).toBe(204)
      expect(cached.headers.has('content-type')).toBe(false)
    }
  })

  it('resolves an alias of `h3` in module code to h3 v2 when a module pins `h3` to h3 v1', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/aliased-h3?q=1')).toEqual({ query: { q: '1' }, h3v2: true })
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
