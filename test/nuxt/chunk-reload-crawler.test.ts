/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'

import chunkReloadCrawlerPlugin from '#app/plugins/chunk-reload-crawler.client'

const reloadNuxtApp = vi.hoisted(() => vi.fn())
vi.mock('#app/composables/chunk', () => ({ reloadNuxtApp }))

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function setUserAgent (userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
}

function setupPlugin () {
  const hooks = createHooks()
  const nuxtApp = { hooks, hook: hooks.hook, callHook: hooks.callHook } as any
  chunkReloadCrawlerPlugin.setup!(nuxtApp)
  return nuxtApp
}

describe('chunk-reload-crawler plugin', () => {
  afterEach(() => {
    reloadNuxtApp.mockReset()
  })

  it('reloads for a bot when a chunk fails during hydration', async () => {
    setUserAgent(GOOGLEBOT)
    const nuxtApp = setupPlugin()

    await nuxtApp.callHook('app:chunkError', { error: new Error('failed to load chunk') })

    expect(reloadNuxtApp).toHaveBeenCalledWith()
  })

  it('does not reload for a bot once hydration has resolved', async () => {
    setUserAgent(GOOGLEBOT)
    const nuxtApp = setupPlugin()
    await nuxtApp.callHook('app:suspense:resolve')

    await nuxtApp.callHook('app:chunkError', { error: new Error('failed to load chunk') })

    expect(reloadNuxtApp).not.toHaveBeenCalled()
  })

  it('does not reload for a regular user agent', async () => {
    setUserAgent(CHROME)
    const nuxtApp = setupPlugin()

    await nuxtApp.callHook('app:chunkError', { error: new Error('failed to load chunk') })

    expect(reloadNuxtApp).not.toHaveBeenCalled()
  })
})
