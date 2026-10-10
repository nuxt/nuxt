/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'

import { loadPayload, shouldLoadPayload } from '#app/composables/payload'

// the test environment builds with `ssr: false`, which disables payload extraction
vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: 'always',
}))

describe('payloadExtraction: \'always\'', () => {
  it('loads payloads for routes that are neither prerendered nor cached', async () => {
    expect(await shouldLoadPayload('/dynamic/thing')).toBe(true)
  })

  it('does not load payloads for routes rendered without ssr or with a redirect', async () => {
    expect(await shouldLoadPayload('/pre/spa/thing')).toBe(false)
    expect(await shouldLoadPayload('/pre/test')).toBe(false)
  })

  it('revalidates dynamic payloads and keeps existing cache modes for prerendered/cached payloads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('[{"data":1},{}]')))
    // resolving whether a route is prerendered can fetch the app manifest first
    const payloadFetchOptions = (path: string) => fetchSpy.mock.calls.find(([url]) => String(url).startsWith(`${path}/_payload.json`))?.[1]
    try {
      // dynamic payloads can change on every render, so the browser cache must not be reused
      await loadPayload('/dynamic/thing')
      expect(payloadFetchOptions('/dynamic/thing')).toMatchObject({ cache: 'no-cache' })

      // prerendered payloads are immutable within a deploy
      await loadPayload('/pre/thing')
      expect(payloadFetchOptions('/pre/thing')).toMatchObject({ cache: 'force-cache' })

      // cached (isr/swr/cache) payloads are revalidated with normal HTTP cache semantics
      await loadPayload('/isr/thing')
      expect(payloadFetchOptions('/isr/thing')).toMatchObject({ cache: 'default' })
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
