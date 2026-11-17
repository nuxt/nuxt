// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { createHead } from '@unhead/vue/client'
import { headSymbol } from '@unhead/vue'
import type { VueHeadClient } from '@unhead/vue/types'
import { createApp as createVueApp, defineComponent, h, inject, provide } from 'vue'
import type { NuxtApp } from '#app/nuxt'

import { installClientHead } from '../src/head/runtime/client-head'
import headPlugin from '../src/head/runtime/plugins/unhead.client'

import { appComponentHead } from '#build/unhead-client.mjs'

function createApp (isHydrating = false) {
  const hooks = createHooks()
  const nuxtApp = { hooks, callHook: hooks.callHook, vueApp: { use: () => {}, _context: { provides: {} } }, isHydrating } as unknown as NuxtApp
  headPlugin(nuxtApp)
  return nuxtApp
}

describe('client head', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    appComponentHead.length = 0
    document.head.replaceChildren()
  })

  it('applies the hoisted app component head when the root component sets up', async () => {
    vi.useFakeTimers()
    appComponentHead.push({ title: 'App', meta: [{ name: 'description', content: 'App' }] })
    const nuxtApp = createApp()
    const head = createHead({ document })

    installClientHead(nuxtApp, head)
    head.push({ title: 'Plugin', meta: [{ name: 'description', content: 'Plugin' }] })
    await nuxtApp.hooks.callHook('vue:setup')
    head.push({ title: 'Page' })

    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('Page')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('App')
  })

  it('applies the hoisted app component head to a head created after the root component sets up', async () => {
    vi.useFakeTimers()
    appComponentHead.push({ title: 'App', meta: [{ name: 'description', content: 'App' }] })
    const nuxtApp = createApp()
    const head = createHead({ document })

    await nuxtApp.hooks.callHook('vue:setup')
    installClientHead(nuxtApp, head)
    head.push({ title: 'Page' })

    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('Page')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('App')
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

  it('renders a head installed after hydration immediately', async () => {
    vi.useFakeTimers()
    const nuxtApp = createApp(true)
    await nuxtApp.hooks.callHook('app:suspense:resolve')

    const head = createHead({ document })
    installClientHead(nuxtApp, head)
    head.push({ title: 'late title' })

    await vi.runAllTimersAsync()
    expect(document.title).toBe('late title')
  })

  it('holds a head installed during navigation until the page finishes', async () => {
    vi.useFakeTimers()
    const nuxtApp = createApp()
    await nuxtApp.hooks.callHook('app:suspense:resolve')
    await nuxtApp.hooks.callHook('page:start')

    const head = createHead({ document })
    installClientHead(nuxtApp, head)
    head.push({ title: 'next page title' })
    expect(vi.getTimerCount()).toBe(0)

    await nuxtApp.hooks.callHook('page:finish')
    await vi.runAllTimersAsync()
    expect(document.title).toBe('next page title')
  })

  it('does not provide a head through injection without the eager factory', () => {
    const hooks = createHooks()
    const vueApp = createVueApp({ render: () => null })
    const nuxtApp = { hooks, vueApp } as unknown as NuxtApp
    headPlugin(nuxtApp)

    expect(vueApp.runWithContext(() => inject(headSymbol))).toBeUndefined()
    expect(nuxtApp['~head']?.head).toBeUndefined()
  })

  it('allows a component to provide its own head', () => {
    const custom = createHead({ document })
    let injected: unknown
    const Child = defineComponent({ setup () { injected = inject(headSymbol); return () => null } })
    const Parent = defineComponent({ setup () { provide(headSymbol, custom); return () => h(Child) } })
    const vueApp = createVueApp(Parent)
    headPlugin({ hooks: createHooks(), vueApp } as unknown as NuxtApp)
    vueApp.mount(document.createElement('div'))

    expect(injected).toBe(custom)
  })

  it('lazily creates one usable head through injection with the eager factory', async () => {
    vi.useFakeTimers()
    await import('../src/head/runtime/client-head-eager')
    const hooks = createHooks()
    const vueApp = createVueApp({ render: () => null })
    const nuxtApp = { hooks, vueApp, isHydrating: false } as unknown as NuxtApp
    headPlugin(nuxtApp)
    await hooks.callHook('app:suspense:resolve')

    expect(nuxtApp['~head']?.head).toBeUndefined()
    const head = vueApp.runWithContext(() => inject<VueHeadClient>(headSymbol))!
    expect(head).toBe(nuxtApp['~head']?.head)
    expect(vueApp.runWithContext(() => inject(headSymbol))).toBe(head)

    head.push({ title: 'lazily injected title' })
    await vi.runAllTimersAsync()
    expect(document.title).toBe('lazily injected title')
  })
})
