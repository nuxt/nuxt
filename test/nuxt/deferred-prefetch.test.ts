/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useNuxtApp } from '#app/nuxt'
import { requestIdleCallback } from '#app/compat/idle-callback'
import deferredPrefetchPlugin from '#app/plugins/deferred-prefetch.client'

type IdleTask = (deadline?: IdleDeadline) => void

const idle = vi.hoisted(() => ({ queue: undefined as undefined | IdleTask[] }))

vi.mock('#app/compat/idle-callback', () => ({
  requestIdleCallback: (cb: IdleTask) => idle.queue ? idle.queue.push(cb) : cb(),
  cancelIdleCallback: () => {},
}))

const ready = () => new Promise<void>(resolve => requestIdleCallback(() => resolve()))

function addHints (links: Array<Record<string, string>>, parent: HTMLElement = document.head) {
  const template = document.createElement('template')
  template.dataset.nuxtPrefetch = ''
  template.dataset.test = ''
  for (const attrs of links) {
    const link = document.createElement('link')
    for (const key in attrs) {
      link.setAttribute(key, attrs[key]!)
    }
    link.dataset.test = ''
    template.content.appendChild(link)
  }
  parent.appendChild(template)
  return template
}

function activeHrefs () {
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][href]')].map(link => new URL(link.href).pathname)
}

async function install () {
  const nuxtApp = useNuxtApp()
  await nuxtApp.runWithContext(() => deferredPrefetchPlugin(nuxtApp))
  await ready()
  await flushPromises()
}

describe('deferred prefetch plugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    for (const el of document.querySelectorAll('[data-test]')) {
      el.remove()
    }
  })

  it('activates inert prefetch hints once the app is ready', async () => {
    addHints([
      { rel: 'prefetch', as: 'script', crossorigin: '', href: '/_nuxt/lazy.js' },
      { rel: 'prefetch', as: 'style', crossorigin: '', href: '/_nuxt/lazy.css' },
    ])

    const nuxtApp = useNuxtApp()
    const isHydrating = nuxtApp.isHydrating
    nuxtApp.isHydrating = true
    try {
      await install()
      expect(activeHrefs()).toEqual([])

      nuxtApp.isHydrating = false
      await nuxtApp.hooks.callHook('app:suspense:resolve')
      await ready()
      await flushPromises()
      expect(activeHrefs()).toEqual(['/_nuxt/lazy.js', '/_nuxt/lazy.css'])
      expect([...document.head.querySelectorAll('link[rel="prefetch"]')].map(link => [link.getAttribute('as'), link.getAttribute('crossorigin')])).toEqual([['script', ''], ['style', '']])
    } finally {
      nuxtApp.isHydrating = isHydrating
    }
  })

  it('only activates hints in the document head', async () => {
    const template = addHints([{ rel: 'prefetch', href: '/_nuxt/in-body.js' }], document.body)

    await install()

    expect(activeHrefs()).toEqual([])
    expect(template.content.querySelectorAll('link')).toHaveLength(1)
  })

  it('only activates hints for build assets', async () => {
    addHints([
      { rel: 'prefetch', href: 'https://attacker.example/beacon' },
      { rel: 'prefetch', href: '/api/logout' },
      { rel: 'prefetch', href: '/_nuxt/../api/logout' },
      { rel: 'prefetch', href: '/_nuxt/%2e%2e/api/logout' },
      { rel: 'prefetch', href: '/_nuxt-other/chunk.js' },
      { rel: 'prefetch', as: 'script', href: '/_nuxt/lazy.js' },
    ])

    await install()

    expect(activeHrefs()).toEqual(['/_nuxt/lazy.js'])
  })

  it('keeps activating hints after one with a malformed url', async () => {
    addHints([
      { rel: 'prefetch', href: 'https://[' },
      { rel: 'prefetch', as: 'script', href: '/_nuxt/lazy.js' },
    ])

    await install()

    expect(activeHrefs()).toEqual(['/_nuxt/lazy.js'])
  })

  it('activates hints across several idle callbacks', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now += 100)
    addHints([
      { rel: 'prefetch', as: 'script', href: '/_nuxt/a.js' },
      { rel: 'prefetch', as: 'script', href: '/_nuxt/b.js' },
      { rel: 'prefetch', as: 'script', href: '/_nuxt/c.js' },
      { rel: 'prefetch', as: 'script', href: '/_nuxt/d.js' },
    ])

    const queue: IdleTask[] = idle.queue = []
    try {
      const nuxtApp = useNuxtApp()
      await nuxtApp.runWithContext(() => deferredPrefetchPlugin(nuxtApp))
      expect(activeHrefs()).toEqual([])

      queue.shift()!()
      expect(activeHrefs()).toEqual(['/_nuxt/a.js'])

      queue.shift()!()
      expect(activeHrefs()).toEqual(['/_nuxt/a.js', '/_nuxt/b.js'])

      queue.shift()!({ didTimeout: false, timeRemaining: () => 250 })
      expect(activeHrefs()).toEqual(['/_nuxt/a.js', '/_nuxt/b.js', '/_nuxt/c.js', '/_nuxt/d.js'])
      expect(queue).toEqual([])
    } finally {
      idle.queue = undefined
    }
  })

  it('leaves the hints inert when the connection cannot afford to prefetch', async () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    addHints([{ rel: 'prefetch', as: 'script', href: '/_nuxt/lazy.js' }])

    await install()

    expect(activeHrefs()).toEqual([])
  })
})
