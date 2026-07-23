/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { resolveComponent, resolveDynamicComponent } from 'vue'
import { NuxtLink } from '#components'

describe('useLink', () => {
  let router: ReturnType<typeof useRouter>

  beforeEach(() => {
    router = useRouter()
    if (!useNuxtApp().vueApp.component('NuxtLinkAlias')) {
      useNuxtApp().vueApp.component('NuxtLinkAlias', NuxtLink)
    }
    router.addRoute({
      name: 'use-link-target',
      path: '/use-link-target',
      component: defineComponent({ setup: () => () => h('div', 'target') }),
    })
  })

  afterEach(async () => {
    await navigateTo('/')
    router.removeRoute('use-link-target')
  })

  async function waitForRoute (fullPath: string) {
    await vi.waitFor(() => {
      if (useNuxtApp()._route.fullPath !== fullPath) {
        throw new Error(`route is ${useNuxtApp()._route.fullPath}`)
      }
    })
  }

  it('useLink navigate importing NuxtLink works', async () => {
    const link = (NuxtLink as any).useLink({ to: '/use-link-target' })
    expect(link.href.value).toBe('/use-link-target')
    await link.navigate()
    expect(useNuxtApp()._route.fullPath).toBe('/use-link-target')
  })

  it('useLink navigate using resolveComponent works', async () => {
    const el = await mountSuspended(defineComponent({
      setup () {
        const component = resolveComponent('NuxtLinkAlias') as any
        const link = component.useLink({ to: '/use-link-target' })
        return () => h('button', { id: 'button2', onClick: () => link.navigate() })
      },
    }))
    await el.get('#button2').trigger('click')
    await waitForRoute('/use-link-target')
    el.unmount()
  })

  it('useLink navigate using resolveDynamicComponent works', async () => {
    const el = await mountSuspended(defineComponent({
      setup () {
        const component = resolveDynamicComponent('NuxtLinkAlias') as any
        const link = component.useLink({ to: '/use-link-target' })
        return () => h('button', { id: 'button3', onClick: () => link.navigate() })
      },
    }))
    await el.get('#button3').trigger('click')
    await waitForRoute('/use-link-target')
    el.unmount()
  })

  it('useLink tracks the prefetch state of a rendered link to the same destination', async () => {
    const { trigger } = useMockObserver()
    const nuxtApp = useNuxtApp()
    delete nuxtApp._observer
    nuxtApp._prefetchedPaths?.clear()
    const callHook = vi.spyOn(nuxtApp.hooks, 'callHook').mockImplementation(() => Promise.resolve() as any)

    let link: any
    const el = await mountSuspended(defineComponent({
      setup () {
        link = (NuxtLink as any).useLink({ to: '/use-link-target' })
        return () => h(NuxtLink as any, { to: '/use-link-target', prefetchedClass: 'prefetched' }, () => 'link')
      },
    }))

    expect(link.prefetched.value).toBe(false)

    await trigger()
    await vi.waitFor(() => {
      expect(link.prefetched.value).toBe(true)
      expect(el.find('a').classes()).toContain('prefetched')
    })

    // already prefetched by the rendered link, so this is a no-op
    await link.prefetch()
    expect(callHook).toHaveBeenCalledTimes(1)

    callHook.mockRestore()
    el.unmount()
  })
})

function useMockObserver () {
  let callback: (entries: Array<{ target: Element, isIntersecting: boolean }>) => unknown
  let el: Element
  const mockObserver = class IntersectionObserver {
    constructor (_callback?: (entries: Array<{ target: Element, isIntersecting: boolean }>) => unknown) {
      callback ||= _callback!
    }

    observe = (_el: Element) => { el = _el }
    unobserve = () => {}
    disconnect = () => {}
  }

  window.IntersectionObserver = mockObserver as any
  return { trigger: () => callback?.([{ target: el, isIntersecting: true }]) }
}
