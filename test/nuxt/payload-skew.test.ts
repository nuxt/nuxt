/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useNuxtApp, useRuntimeConfig } from '#app/nuxt'
import { loadPayload } from '#app/composables/payload'
import { useRouter } from '#app/composables/router'
import payloadPlugin from '#app/plugins/payload.client'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
}))

const reloadNuxtApp = vi.hoisted(() => vi.fn())
vi.mock('#app/composables/chunk', () => ({ reloadNuxtApp }))

function mockPayload (buildId: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(`[{"data":1,"buildId":2},{"key":3},"${buildId}","value"]`)))
}

describe('payloads from another build', () => {
  beforeAll(() => {
    const nuxtApp = useNuxtApp()
    nuxtApp.runWithContext(() => payloadPlugin.setup!(nuxtApp))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    reloadNuxtApp.mockReset()
    delete useNuxtApp().static.data.key
    await useRouter().push('/')
  })

  it('should not return a payload from another build', async () => {
    mockPayload('another-build')
    expect(await loadPayload('/pre/other-build', { fresh: true })).toBeNull()
  })

  it('should return a payload from the current build', async () => {
    mockPayload(useRuntimeConfig().app.buildId)
    expect(await loadPayload('/pre/current-build', { fresh: true })).toMatchObject({ data: { key: 'value' } })
  })

  it('should reload the app at the destination when navigating to a payload from another build', async () => {
    mockPayload('another-build')
    await useRouter().push('/pre/skewed?foo=bar')
    expect(reloadNuxtApp).toHaveBeenCalledWith({ path: '/pre/skewed?foo=bar', persistState: true })
    expect(useNuxtApp().static.data.key).toBeUndefined()
  })

  it('should apply a payload from the current build on navigation', async () => {
    mockPayload(useRuntimeConfig().app.buildId)
    await useRouter().push('/pre/aligned')
    expect(reloadNuxtApp).not.toHaveBeenCalled()
    expect(useNuxtApp().static.data.key).toBe('value')
  })

  it('should signal a newer build once when a prefetched payload is from another build', async () => {
    mockPayload('another-build')
    const nuxtApp = useNuxtApp()
    const onUpdate = vi.fn()
    const unhook = nuxtApp.hook('app:manifest:update', onUpdate)
    try {
      await nuxtApp.callHook('link:prefetch', '/pre/prefetched-a')
      await nuxtApp.callHook('link:prefetch', '/pre/prefetched-b')
      await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
      expect(reloadNuxtApp).not.toHaveBeenCalled()
    } finally {
      unhook()
    }
  })
})
