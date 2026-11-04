/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import { reloadNuxtApp } from '#app/composables/chunk'
import payloadPlugin from '#app/plugins/payload.client'
import islandLinkNavigationPlugin from '#app/plugins/island-link-navigation.client'

vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
  componentIslands: true,
}))

const parent = new URL(window.location.href)

function mockSrcdocDocument () {
  const location = {
    href: 'about:srcdoc',
    origin: 'null',
    protocol: 'about:',
    host: '',
    hostname: '',
    pathname: 'srcdoc',
    search: '',
    hash: '',
    reload: vi.fn(),
  }
  vi.spyOn(window, 'location', 'get').mockReturnValue(location as unknown as Location)
  vi.spyOn(document, 'baseURI', 'get').mockReturnValue(parent.href)
  vi.spyOn(window.history, 'pushState').mockImplementation(() => {})
  vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
  return location
}

describe('app in an `<iframe srcdoc>` document', () => {
  beforeAll(async () => {
    const nuxtApp = useNuxtApp()
    await nuxtApp.runWithContext(() => payloadPlugin(nuxtApp))
    await nuxtApp.runWithContext(() => islandLinkNavigationPlugin(nuxtApp))
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await useRouter().push('/')
  })

  it('should complete navigation', async () => {
    mockSrcdocDocument()
    await expect(useRouter().push('/index?srcdoc')).resolves.toBeUndefined()
    expect(useRouter().currentRoute.value.fullPath).toBe('/index?srcdoc')
  })

  it('should prefetch the payload of a same-origin link', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('[{"data":1},{}]')))
    mockSrcdocDocument()
    await useNuxtApp().hooks.callHook('link:prefetch', '/pre/srcdoc')
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/pre/srcdoc/_payload.json'), expect.anything()))
  })

  it('should navigate client-side from a link rendered in an island', async () => {
    mockSrcdocDocument()
    const anchor = document.createElement('a')
    anchor.setAttribute('href', '/index')
    anchor.setAttribute('data-internal', '')
    document.body.appendChild(anchor)
    try {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      anchor.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      await vi.waitFor(() => expect(useRouter().currentRoute.value.fullPath).toBe('/index'))
    } finally {
      anchor.remove()
    }
  })

  it('should reload the current document', () => {
    const location = mockSrcdocDocument()
    reloadNuxtApp({ force: true })
    expect(location.reload).toHaveBeenCalledTimes(1)
  })
})

describe('app in a sandboxed `<iframe>` document', () => {
  afterEach(() => {
    delete (window as { origin?: string }).origin
  })

  it('should allow reloading a same-origin path', () => {
    Object.defineProperty(window, 'origin', { configurable: true, value: 'null' })
    expect(() => reloadNuxtApp({ path: '/legit/path' })).not.toThrow()
  })
})
