/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'
import { stringify } from 'devalue'
import { useNuxtApp } from '#app/nuxt'
import payloadPlugin from '#app/plugins/payload.client'
import { createClientHead } from '#build/unhead-client.mjs'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
  prefetchPreloadTags: true,
}))

vi.mock('#build/unhead-client.mjs', async (importOriginal) => {
  const original = await importOriginal<typeof import('#build/unhead-client.mjs')>()
  return { ...original, createClientHead: vi.fn(original.createClientHead) }
})

describe('forwarded payload prefetch hints', () => {
  it('should not create the client head', async () => {
    const payload = stringify({
      data: {},
      prefetchLinks: [{ rel: 'preload', as: 'fetch', href: '/hint.txt' }],
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(payload)))
    const nuxtApp = useNuxtApp()
    nuxtApp.runWithContext(() => payloadPlugin.setup!(nuxtApp))

    await nuxtApp.callHook('link:prefetch', '/pre/hints')
    await vi.waitFor(() => expect(document.head.querySelector('link[rel="prefetch"][href="/hint.txt"]')).not.toBeNull())

    expect(createClientHead).not.toHaveBeenCalled()
  })
})
