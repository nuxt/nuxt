/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { stringify } from 'devalue'
import { useNuxtApp } from '#app/nuxt'
import { useRouter } from '#app/composables/router'
import payloadPlugin from '#app/plugins/payload.client'
import { createClientHead } from '#build/unhead-client.mjs'
import { createHead } from '@unhead/vue/client'

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
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let router: ReturnType<typeof useRouter>
  let navigations = 0
  const hintLinks: Record<string, Record<string, string>> = {}

  beforeAll(() => {
    nuxtApp = useNuxtApp()
    router = useRouter()
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const name = new URL(String(input), 'http://localhost').pathname.split('/')[2]!
      return Promise.resolve(new Response(stringify({
        data: {},
        prefetchLinks: [hintLinks[name] ?? { rel: 'preload', as: 'fetch', href: `/${name}.txt` }],
      })))
    })
    nuxtApp.runWithContext(() => payloadPlugin.setup!(nuxtApp))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function forwardHint (name: string, selector = `link[rel="prefetch"][href="/${name}.txt"]`) {
    await nuxtApp.callHook('link:prefetch', `/pre/${name}`)
    let hint: Element | null = null
    await vi.waitFor(() => {
      hint = document.head.querySelector(selector)
      expect(hint).not.toBeNull()
    })
    return hint!
  }

  function navigate () {
    return router.push({ path: router.currentRoute.value.path, query: { navigation: ++navigations } })
  }

  it('should not create the client head', async () => {
    await forwardHint('head')
    expect(createClientHead).not.toHaveBeenCalled()
  })

  it('should remove forwarded hints after the head update that follows page:finish', async () => {
    const hint = await forwardHint('finish')
    await navigate()
    expect(hint.isConnected).toBe(true)

    await nuxtApp.callHook('page:finish')
    expect(hint.isConnected).toBe(true)
    await vi.waitFor(() => expect(hint.isConnected).toBe(false))
  })

  it('should release the handlers of removed forwarded hints', async () => {
    const hint = await forwardHint('release') as HTMLLinkElement
    expect(hint.onload).toBeTypeOf('function')
    await navigate()
    await nuxtApp.callHook('page:finish')
    await vi.waitFor(() => expect(hint.isConnected).toBe(false))

    expect(hint.onload).toBeNull()
    expect(hint.onerror).toBeNull()
  })

  it('should not copy the id of forwarded hints', async () => {
    hintLinks.id = { rel: 'preload', as: 'style', href: '/theme.css', id: 'theme' }
    const hint = await forwardHint('id', 'link[href="/theme.css"]')
    expect(hint.hasAttribute('id')).toBe(false)
  })

  it('should keep the head\'s own links that match a forwarded hint', async () => {
    hintLinks.adopt = { rel: 'preload', as: 'image', href: '/hero.png' }
    const hint = await forwardHint('adopt', 'link[rel="preload"][href="/hero.png"]')
    await navigate()

    const head = createHead()
    head.push({ link: [{ rel: 'preload', as: 'image', href: '/hero.png' }] })
    head.render()
    await nuxtApp.callHook('page:finish')
    await vi.waitFor(() => expect(hint.isConnected).toBe(false))

    expect(document.head.querySelectorAll('link[rel="preload"][href="/hero.png"]')).toHaveLength(1)
  })

  it('should remove forwarded hints straight away when navigation fails', async () => {
    const hint = await forwardHint('failure')
    await router.push(router.currentRoute.value.fullPath)
    expect(hint.isConnected).toBe(false)
  })

  it('should remove forwarded hints when page:finish does not follow navigation', async () => {
    const hint = await forwardHint('timeout')
    vi.useFakeTimers()
    const navigation = navigate()
    await vi.advanceTimersByTimeAsync(1_000)
    await navigation
    expect(hint.isConnected).toBe(true)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(hint.isConnected).toBe(false)
  })
})
