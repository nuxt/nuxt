// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { createHead } from '@unhead/vue/client'
import type { NuxtApp } from '#app/nuxt'

import { installClientHead } from '../src/head/runtime/install-client-head'

function createApp (isHydrating = false) {
  const hooks = createHooks()
  return { hooks, callHook: hooks.callHook, vueApp: { use: () => {} }, isHydrating } as unknown as NuxtApp
}

describe('client head', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not schedule DOM renders while updates are paused', async () => {
    vi.useFakeTimers()
    const nuxtApp = createApp()
    const head = createHead({ document })

    installClientHead(nuxtApp, head)
    head.push({ title: 'paused title' })

    expect(vi.getTimerCount()).toBe(0)

    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await vi.runAllTimersAsync()

    expect(document.title).toBe('paused title')
  })

  it('renders live updates and resumes when navigating', async () => {
    vi.useFakeTimers()
    const nuxtApp = createApp()
    const head = createHead({ document })

    installClientHead(nuxtApp, head)
    const entry = head.push({ title: 'initial head' })

    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('initial head')

    entry.patch({ title: 'live head update' })
    await vi.runAllTimersAsync()
    expect(document.title).toBe('live head update')

    await nuxtApp.hooks.callHook('page:start')
    entry.patch({ title: 'pending navigation head' })
    expect(vi.getTimerCount()).toBe(0)

    await nuxtApp.hooks.callHook('page:finish')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('pending navigation head')
  })

  it('does not unpause on page:finish while hydrating', async () => {
    vi.useFakeTimers()
    const nuxtApp = createApp(true)
    const head = createHead({ document })

    installClientHead(nuxtApp, head)
    head.push({ title: 'hydration title' })

    await nuxtApp.hooks.callHook('page:finish')
    await vi.runAllTimersAsync()
    expect(document.title).not.toBe('hydration title')

    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('hydration title')
  })
})
