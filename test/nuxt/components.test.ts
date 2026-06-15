/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'

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

describe('nuxt-link:hash-focus', () => {
  it('should focus target element after hash link navigation', async () => {
    const component = defineNuxtLink(nuxtLinkDefaults)
    const router = useRouter()

    // Create a mock element with id "target"
    const targetEl = document.createElement('div')
    targetEl.id = 'target'
    targetEl.tabIndex = -1 // Make it focusable
    document.body.appendChild(targetEl)

    const focusSpy = vi.spyOn(targetEl, 'focus')

    // Mock router.push to resolve immediately
    const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    const wrapper = await mountSuspended(component, { props: { to: '#target' } })
    const link = wrapper.find('a')

    // Trigger click on the hash link
    await link.trigger('click')
    await flushPromises()

    // Wait for the async onClick handler to complete
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(pushSpy).toHaveBeenCalledWith('#target')
    expect(focusSpy).toHaveBeenCalled()

    // Cleanup
    document.body.removeChild(targetEl)
    pushSpy.mockRestore()
    focusSpy.mockRestore()
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
