/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useNuxtApp } from '#app/nuxt'
import { requestIdleCallback } from '#app/compat/idle-callback'
import deferredPrefetchPlugin from '#app/plugins/deferred-prefetch.client'

const ready = () => new Promise<void>(resolve => requestIdleCallback(() => resolve()))

function addLink (attrs: Record<string, string>) {
  const link = document.createElement('link')
  for (const key in attrs) {
    link.setAttribute(key, attrs[key]!)
  }
  link.dataset.test = ''
  document.head.appendChild(link)
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
    for (const el of document.head.querySelectorAll('[data-test]')) {
      el.remove()
    }
  })

  it('activates inert prefetch hints once the app is ready', async () => {
    addLink({ 'rel': 'prefetch', 'as': 'script', 'crossorigin': '', 'data-href': '/_nuxt/lazy.js' })
    addLink({ 'rel': 'prefetch', 'as': 'style', 'crossorigin': '', 'data-href': '/_nuxt/lazy.css' })

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
    } finally {
      nuxtApp.isHydrating = isHydrating
    }
  })

  it('only activates hints in the document head', async () => {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.dataset.href = '/_nuxt/in-body.js'
    link.dataset.test = ''
    document.body.appendChild(link)
    try {
      await install()

      expect(link.hasAttribute('href')).toBe(false)
    } finally {
      link.remove()
    }
  })

  it('only activates hints for build assets', async () => {
    addLink({ 'rel': 'prefetch', 'data-href': 'https://attacker.example/beacon' })
    addLink({ 'rel': 'prefetch', 'data-href': '/api/logout' })
    addLink({ 'rel': 'prefetch', 'data-href': '/_nuxt/../api/logout' })
    addLink({ 'rel': 'prefetch', 'data-href': '/_nuxt/%2e%2e/api/logout' })
    addLink({ 'rel': 'prefetch', 'data-href': '/_nuxt-other/chunk.js' })
    addLink({ 'rel': 'prefetch', 'as': 'script', 'data-href': '/_nuxt/lazy.js' })

    await install()

    expect(activeHrefs()).toEqual(['/_nuxt/lazy.js'])
  })

  it('keeps activating hints after one with a malformed url', async () => {
    addLink({ 'rel': 'prefetch', 'data-href': 'https://[' })
    addLink({ 'rel': 'prefetch', 'as': 'script', 'data-href': '/_nuxt/lazy.js' })

    await install()

    expect(activeHrefs()).toEqual(['/_nuxt/lazy.js'])
  })

  it('leaves the hints inert when the connection cannot afford to prefetch', async () => {
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    addLink({ 'rel': 'prefetch', 'as': 'script', 'data-href': '/_nuxt/lazy.js' })

    await install()

    expect(activeHrefs()).toEqual([])
  })
})
