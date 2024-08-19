/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

import { nuxtLinkDefaults } from '#build/nuxt.config.mjs'

describe('nuxt-link:prefetch', () => {
  it('should prefetch on visibility by default', async () => {
    const component = defineNuxtLink(nuxtLinkDefaults)

    const { observer } = useMockObserver()

    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.callHook = vi.fn(() => Promise.resolve())

    await mountSuspended(component, { props: { to: '/to' } })

    expect(nuxtApp.hooks.callHook).not.toHaveBeenCalled()

    await observer.trigger()
    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)

    await observer.trigger()
    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)
  })

  it('should prefetch with custom string `prefetchOn`', async () => {
    const component = defineNuxtLink(nuxtLinkDefaults)
    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.callHook = vi.fn(() => Promise.resolve())

    const { observer } = useMockObserver()
    const wrapper = await mountSuspended(component, { props: { to: '/to', prefetchOn: 'interaction' } })

    await observer.trigger()
    expect(nuxtApp.hooks.callHook).not.toHaveBeenCalled()

    await wrapper.find('a').trigger('focus')
    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)

    await wrapper.find('a').trigger('focus')
    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)

    await wrapper.find('a').trigger('pointerenter')
    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)
  })

  it('should prefetch with custom object `prefetchOn`', async () => {
    const component = defineNuxtLink(nuxtLinkDefaults)
    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.callHook = vi.fn(() => Promise.resolve())

    const { observer } = useMockObserver()
    await mountSuspended(component, { props: { to: '/to', prefetchOn: { interaction: true } } })

    await observer.trigger()
    expect(nuxtApp.hooks.callHook).toHaveBeenCalled()
  })

  it('should prefetch with custom object `prefetchOn` overriding default', async () => {
    const component = defineNuxtLink(nuxtLinkDefaults)
    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.callHook = vi.fn(() => Promise.resolve())

    const { observer } = useMockObserver()
    await mountSuspended(component, { props: { to: '/to', prefetchOn: { interaction: true, visibility: false } } })

    await observer.trigger()
    expect(nuxtApp.hooks.callHook).not.toHaveBeenCalled()
  })
})

function useMockObserver () {
  let callback: (entries: Array<{ target: HTMLElement, isIntersecting: boolean }>) => unknown
  let el: HTMLElement
  const mockObserver = class IntersectionObserver {
    el: HTMLElement
    constructor (_callback?: (entries: Array<{ target: HTMLElement, isIntersecting: boolean }>) => unknown) {
      callback ||= _callback
    }

    observe = (_el: HTMLElement) => { el = _el }

    trigger = () => callback?.([{ target: el, isIntersecting: true }])
    unobserve = () => {}
    disconnect = () => {}
  }

  window.IntersectionObserver = mockObserver as any

  const observer = new mockObserver()

  return { observer }
}
