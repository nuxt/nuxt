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

  it('should expose prefetch controls to the custom slot on an internal link', async () => {
    const NuxtLink = defineNuxtLink(nuxtLinkDefaults)
    const nuxtApp = useNuxtApp()
    nuxtApp.hooks.callHook = vi.fn(() => Promise.resolve())

    let prefetch: ((nuxtApp?: ReturnType<typeof useNuxtApp>) => Promise<void>) | undefined
    let shouldPrefetch: ((mode: 'visibility' | 'interaction') => boolean) | undefined

    const wrapper = await mountSuspended(defineComponent({
      render () {
        return h(NuxtLink, { to: '/to', custom: true, prefetchedClass: 'is-prefetched' }, {
          default: (slotProps: {
            href: string
            prefetch: (nuxtApp?: ReturnType<typeof useNuxtApp>) => Promise<void>
            prefetched: boolean
            shouldPrefetch: (mode: 'visibility' | 'interaction') => boolean
          }) => {
            prefetch = slotProps.prefetch
            shouldPrefetch = slotProps.shouldPrefetch
            return h('a', { href: slotProps.href, class: slotProps.prefetched ? 'is-prefetched' : '' }, 'link')
          },
        })
      },
    }))

    expect(nuxtApp.hooks.callHook).not.toHaveBeenCalled()
    expect(wrapper.find('a').classes()).not.toContain('is-prefetched')
    expect(shouldPrefetch?.('visibility')).toBe(true)
    expect(prefetch).toEqual(expect.any(Function))

    await prefetch?.(nuxtApp)
    await flushPromises()

    expect(nuxtApp.hooks.callHook).toHaveBeenCalledTimes(1)
    expect(wrapper.find('a').classes()).toContain('is-prefetched')
    expect(shouldPrefetch?.('visibility')).toBe(false)
  })

  it('should preserve RouterLink slot props on an internal custom link', async () => {
    const NuxtLink = defineNuxtLink(nuxtLinkDefaults)
    const router = useRouter()
    const to = router.currentRoute.value.path || '/'
    let slotProps: {
      href: string
      route?: { href: string }
      isActive: boolean
      isExactActive: boolean
      prefetch: (nuxtApp?: ReturnType<typeof useNuxtApp>) => Promise<void>
      prefetched: boolean
      shouldPrefetch: (mode: 'visibility' | 'interaction') => boolean
    } | undefined

    await mountSuspended(defineComponent({
      render () {
        return h(NuxtLink, { to, custom: true }, {
          default: (props: typeof slotProps) => {
            slotProps = props
            return h('a', { href: props?.href }, 'link')
          },
        })
      },
    }))

    expect(slotProps?.href).toBe(to)
    expect(slotProps?.route?.href).toBe(to)
    expect(slotProps?.isActive).toBe(true)
    expect(slotProps?.isExactActive).toBe(true)
    expect(slotProps?.prefetch).toEqual(expect.any(Function))
    expect(slotProps?.prefetched).toBe(false)
    expect(slotProps?.shouldPrefetch).toEqual(expect.any(Function))
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
