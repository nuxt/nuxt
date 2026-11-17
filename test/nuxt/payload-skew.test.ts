/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useNuxtApp, useRuntimeConfig } from '#app/nuxt'
import { _loadPayload, loadPayload } from '#app/composables/payload'
import { useRouter } from '#app/composables/router'
import payloadPlugin from '#app/plugins/payload.client'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
}))

const reloadNuxtApp = vi.hoisted(() => vi.fn())
vi.mock('#app/composables/chunk', () => ({ reloadNuxtApp }))

const payloadBody = (buildId: string) => `[{"data":1,"buildId":2},{"key":3},"${buildId}","value"]`

function mockPayload (buildId: string) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(payloadBody(buildId))))
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

  it('should reload for a payload from another build that uses types unknown to this build', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('[{"data":1,"buildId":3},["UnknownType",2],{},"another-build"]')))
    await useRouter().push('/pre/unknown-type')
    expect(reloadNuxtApp).toHaveBeenCalledWith({ path: '/pre/unknown-type', persistState: true })
  })

  it('should not reload for a payload from another build once the navigation is superseded', async () => {
    let release!: (response: Response) => void
    const fetchSpy = mockPayload(useRuntimeConfig().app.buildId)
    fetchSpy.mockImplementationOnce(() => new Promise(resolve => (release = resolve)))
    const router = useRouter()

    const superseded = router.push('/pre/superseded')
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    await router.push('/pre/latest')
    release(new Response(payloadBody('another-build')))
    await superseded

    expect(reloadNuxtApp).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/pre/latest')
  })

  it('should only key immutable payload urls on the build id', async () => {
    const fetchSpy = mockPayload(useRuntimeConfig().app.buildId)
    await loadPayload('/pre/keyed')
    await loadPayload('/isr/unkeyed?page=2')
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      `/pre/keyed/_payload.json?_b=${useRuntimeConfig().app.buildId}`,
      '/isr/unkeyed/_payload.json?page=2',
    ])
  })

  it('should revalidate a cached payload from another build before reloading', async () => {
    const fetchSpy = mockPayload(useRuntimeConfig().app.buildId)
    fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(payloadBody('another-build'))))
    await useRouter().push('/isr/revalidated')
    expect(fetchSpy.mock.calls.map(([, init]) => init?.cache)).toEqual(['default', 'no-cache'])
    expect(reloadNuxtApp).not.toHaveBeenCalled()
    expect(useNuxtApp().static.data.key).toBe('value')
  })

  it('should reload when a revalidated cached payload is still from another build', async () => {
    const fetchSpy = mockPayload('another-build')
    await useRouter().push('/isr/skewed')
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(reloadNuxtApp).toHaveBeenCalledWith({ path: '/isr/skewed', persistState: true })
  })

  it('should reload when a cached payload from another build cannot be revalidated', async () => {
    const fetchSpy = mockPayload('another-build')
    fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(payloadBody('another-build'))))
    fetchSpy.mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
    await useRouter().push('/isr/offline')
    expect(fetchSpy.mock.calls.map(([, init]) => init?.cache)).toEqual(['default', 'no-cache'])
    expect(reloadNuxtApp).toHaveBeenCalledWith({ path: '/isr/offline', persistState: true })
  })

  it('should discard a cached payload from another build when revalidation is aborted', async () => {
    const controller = new AbortController()
    const fetchSpy = mockPayload('another-build')
    fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(payloadBody('another-build'))))
    fetchSpy.mockImplementationOnce(() => {
      controller.abort()
      return Promise.reject(new DOMException('aborted', 'AbortError'))
    })
    expect(await _loadPayload('/isr/aborted', { signal: controller.signal })).toBeNull()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('should not signal a newer build when a prefetched cached payload revalidates to the current build', async () => {
    const fetchSpy = mockPayload(useRuntimeConfig().app.buildId)
    fetchSpy.mockImplementationOnce(() => Promise.resolve(new Response(payloadBody('another-build'))))
    const nuxtApp = useNuxtApp()
    const onUpdate = vi.fn()
    const unhook = nuxtApp.hook('app:manifest:update', onUpdate)
    try {
      await nuxtApp.callHook('link:prefetch', '/isr/prefetched')
      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
      await new Promise(resolve => setTimeout(resolve))
      expect(onUpdate).not.toHaveBeenCalled()
    } finally {
      unhook()
    }
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
