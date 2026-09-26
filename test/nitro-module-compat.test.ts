import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

const shouldRun = runsOncePerEnvInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/nitro-module-compat', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!shouldRun)('nitro v2 module compatibility without `nitroLegacy`', () => {
  it('runs a v1-style module handler', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/untagged')).toEqual({
      flavour: 'earl-grey',
      hasStorage: true,
      hasNitroApp: true,
    })
  })

  it('injects the v2 auto-imports into module runtime code', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/untagged-auto')).toEqual({
      flavour: 'earl-grey',
      hasNitroApp: true,
    })
  })

  it('leaves the request body readable after a v2 middleware reads it', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/body-echo', { method: 'POST', body: { a: 1 } })).toEqual({
      fromMiddleware: { a: 1 },
      fromRoute: { a: 1 },
    })
  })

  it('transforms handlers pushed straight into `nitro.options`', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/late')).toEqual({
      flavour: 'earl-grey',
      hasQuery: true,
    })
  })

  it('resolves the matched route rules for the v2 `getRouteRules(event)` and `context._nitro`', async () => {
    const body = await $fetch<Record<string, Record<string, unknown>>>('/api/untagged-rules')

    expect(body.fromHelper).toMatchObject({ headers: { 'x-untagged': 'rules' } })
    expect(body.fromContext).toEqual(body.fromHelper)
  })

  it('transforms a module virtual whose contents need the nitro instance', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/nitro-dependent')).toMatchObject({
      flavour: 'earl-grey',
      preset: expect.any(String),
    })
  })

  it('transforms a utility registered through `addServerImports`', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/via-imports')).toEqual({
      flavour: 'earl-grey',
      assetURL: 'logo.png',
      hasEnv: true,
    })
  })

  it('transforms module runtime reached through a module-owned alias', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/via-alias')).toEqual({
      flavour: 'earl-grey',
      method: 'GET',
    })
  })

  it('applies response headers set from the v2 `render:response` hook', async () => {
    const response = await fetch('/')
    expect(response.headers.get('content-security-policy')).toBe(`script-src 'nonce-test'`)
    expect(response.headers.get('x-render-response')).toBe('applied')
  })

  it('replaces the rendered html from the v2 `render:response` hook', async () => {
    const html = await $fetch<string>('/?replace-body=1')
    expect(html).toContain('replaced by the v2 hook')
    expect(html).not.toContain('nitro-module-compat fixture')
  })

  it('matches the route of a v2 module handler exactly, as the v2 router did', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/prefixed')).toEqual({ path: '/api/prefixed' })

    // nitro v2 registered a routed handler on the h3 v1 router, which matched it exactly,
    // so a path below it falls through to the app on either version
    for (const path of ['/api/prefixed/deep/x', '/api/migrated/deep']) {
      const deep = await fetch(path)
      expect(deep.headers.get('content-type')).toContain('text/html')
    }
  })

  it('emits the v2 `beforeResponse` hook for a module plugin', async () => {
    const response = await fetch('/api/untagged')
    expect(response.headers.get('x-before-response')).toBe('applied')
  })

  it('applies header writes made from a bridged `beforeResponse` hook', async () => {
    const response = await fetch('/api/response-headers')

    expect(response.headers.get('x-legacy-header')).toBe('applied')
    expect(response.headers.get('x-route-header')).toBe(null)
  })

  it('decorates events reaching module utilities from an unwrapped user route', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/via-util')).toEqual({
      pong: 'pong',
      viaCaptureError: true,
    })
  })

  it('leaves a module that has migrated to nitro v3 alone', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/migrated')).toEqual({ flavour: 'earl-grey' })

    const error = await $fetch<Record<string, unknown>>('/api/migrated?fail=1', { ignoreResponseError: true })
    expect(error).toMatchObject({ status: 410 })
    expect(error).not.toHaveProperty('statusCode')
  })

  it('recovers the status of an h3 v1 error bundled into a module', async () => {
    const shimmed = await fetch('/api/foreign-error')
    expect(shimmed.status).toBe(404)
    expect(await shimmed.json()).toMatchObject({ statusCode: 404, data: { from: 'bundled-h3' } })

    // The same error from a file with no `h3` import at all, so nothing shims it.
    // h3 recovers the status by itself here, but flags the error `unhandled`, which
    // scrubs `message` and `data` from the body: that is what the recovery restores.
    const unshimmed = await fetch('/api/bundled-h3-error')
    expect(unshimmed.status).toBe(401)
    expect(await unshimmed.json()).toMatchObject({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'nope',
      data: { from: 'bundled-h3' },
    })

    // A thrown plain object, which h3 v2 would otherwise serialise as a 200 body. Its shape
    // is also the shape of a rethrown upstream payload, so the status is kept but the
    // message and `data` are not.
    const plain = await fetch('/api/foreign-error?plain=1')
    expect(plain.status).toBe(402)
    const plainBody = await plain.json()
    expect(plainBody).toMatchObject({ statusCode: 402, statusMessage: 'Payment Required' })
    expect(plainBody).not.toHaveProperty('data')
  })

  // in dev the server deliberately returns the error detail; this is about production
  it.skipIf(isDev)('does not serialise the detail of an error a handler gave no status', async () => {
    const response = await fetch('/api/unhandled-error')
    const body = await response.text()

    expect(response.status).toBe(500)
    expect(body).not.toContain('postgres://')
    expect(JSON.parse(body)).toMatchObject({ unhandled: true })
  })

  it('serialises `createError` with the v2 keys', async () => {
    expect(await $fetch<Record<string, unknown>>('/api/untagged?fail=1', { ignoreResponseError: true }))
      .toMatchObject({ statusCode: 418, statusMessage: 'I am a teapot', data: { from: 'untagged' } })
  })
})
