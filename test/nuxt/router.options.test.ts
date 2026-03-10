/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { NuxtLayout, NuxtPage } from '#components'
import layouts from '#build/layouts.mjs'

describe('scrollBehavior of router options with global transition', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>

  let wrapper: VueWrapper<unknown>
  let scrollTo: ReturnType<typeof vi.spyOn>
  const cleanups: Array<() => void> = []

  const pageTransitionFinish = vi.fn()
  const pageLoadingEnd = vi.fn()

  async function completeNavigation () {
    await flushPromises()

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
  }

  beforeAll(async () => {
    router = useRouter()
    nuxtApp = useNuxtApp()

    router.addRoute({
      name: 'transitions',
      path: '/transitions',
      component: NestedPageParent,
      children: [{ path: 'async', component: AsyncComponent }, { path: 'sync', component: SyncComponent }],
    })

    cleanups.push(nuxtApp.hook('page:transition:finish', pageTransitionFinish))
    cleanups.push(nuxtApp.hook('page:loading:end', pageLoadingEnd))

    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(NuxtPage, {
        transition: {
          name: 'fade',
          mode: 'out-in',
          duration: 10,
        },
      }),
    }), { global: { stubs: { transition: false } } })
    await flushPromises()
  })

  beforeEach(async () => {
    await navigateTo('/')
    await flushPromises()
    vi.clearAllMocks()
    scrollTo = vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
  })

  afterAll(() => {
    router.removeRoute('transitions')
    wrapper.unmount()
    for (const cleanup of cleanups) {
      cleanup()
    }
  })

  it('should not trigger scrollTo when trailing slash is added/removed', async () => {
    await navigateTo('/about')
    await completeNavigation()

    expect(scrollTo).toHaveBeenCalled()
    vi.clearAllMocks()

    await navigateTo('/about/')
    await completeNavigation()

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('should call scrollTo after page transition is finished with async component', async () => {
    await navigateTo('/transitions/async')
    await completeNavigation()

    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should call scrollTo after page transition is finished with sync component', async () => {
    await navigateTo('/transitions/sync')
    await completeNavigation()

    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should set _transitionPromise at page:start and clean up after transition finishes with async component', async () => {
    let transitionPromiseAtStart: Promise<void> | undefined

    const pageStartSpy = vi.fn(() => {
      transitionPromiseAtStart = nuxtApp['~transitionPromise']
    })

    cleanups.push(nuxtApp.hook('page:start', pageStartSpy))

    await navigateTo('/transitions/async')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    // Verify _transitionPromise exists at page:start
    expect(transitionPromiseAtStart).toBeInstanceOf(Promise)
    // Verify _transitionPromise is cleaned up after transition finishes
    expect(nuxtApp['~transitionPromise']).toBeUndefined()
    expect(nuxtApp['~transitionFinish']).toBeUndefined()
    expect(pageStartSpy).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should set _transitionPromise at page:start and clean up after transition finishes with sync component', async () => {
    let transitionPromiseAtStart: Promise<void> | undefined

    const pageStartSpy = vi.fn(() => {
      transitionPromiseAtStart = nuxtApp['~transitionPromise']
    })

    cleanups.push(nuxtApp.hook('page:start', pageStartSpy))

    await navigateTo('/transitions/sync')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    // Verify _transitionPromise exists at page:start
    expect(transitionPromiseAtStart).toBeInstanceOf(Promise)
    // Verify _transitionPromise is cleaned up after transition finishes
    expect(nuxtApp['~transitionPromise']).toBeUndefined()
    expect(nuxtApp['~transitionFinish']).toBeUndefined()
    // Verify pageLoadingEnd and scrollTo are also called
    expect(pageStartSpy).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })
})

describe('scrollBehavior with cross-layout transitions (#34196)', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>

  let wrapper: VueWrapper<unknown>
  let scrollTo: ReturnType<typeof vi.spyOn>
  const cleanups: Array<() => void> = []

  const pageLoadingEnd = vi.fn()
  const layoutAfterLeave = vi.fn()
  const addedLayouts = ['scroll-layout-a', 'scroll-layout-b']

  beforeAll(async () => {
    router = useRouter()
    nuxtApp = useNuxtApp()

    // Register test layouts
    for (const layout of addedLayouts) {
      layouts[layout] = defineComponent({
        setup (_, ctx) {
          return () => h('div', { class: layout }, ctx.slots.default?.())
        },
      })
    }

    // Register routes with different layouts and a layout transition.
    // The onAfterLeave spy lets us observe when the transition animation finishes.
    const layoutTransition = {
      name: 'layout',
      mode: 'out-in' as const,
      duration: 10,
      onAfterLeave: () => layoutAfterLeave(),
    }

    router.addRoute({
      name: 'scroll-layout-a',
      path: '/scroll-layout-a',
      meta: {
        // @ts-expect-error dynamically-added layout
        layout: 'scroll-layout-a',
        layoutTransition,
      },
      component: defineComponent({ setup: () => () => h('div', 'Page A') }),
    })

    router.addRoute({
      name: 'scroll-layout-b',
      path: '/scroll-layout-b',
      meta: {
        // @ts-expect-error dynamically-added layout
        layout: 'scroll-layout-b',
        layoutTransition,
      },
      component: defineComponent({ setup: () => () => h('div', 'Page B') }),
    })

    cleanups.push(nuxtApp.hook('page:loading:end', pageLoadingEnd))

    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(NuxtLayout, null, {
        default: () => h(NuxtPage),
      }),
    }), { global: { stubs: { transition: false } } })
    await flushPromises()
  })

  beforeEach(async () => {
    await navigateTo('/')
    await flushPromises()
    vi.clearAllMocks()
    scrollTo = vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
  })

  afterAll(() => {
    router.removeRoute('scroll-layout-a')
    router.removeRoute('scroll-layout-b')
    for (const layout of addedLayouts) {
      delete layouts[layout]
    }
    wrapper.unmount()
    for (const cleanup of cleanups) {
      cleanup()
    }
  })

  it('should not scrollTo before the layout transition finishes on cross-layout navigation', async () => {
    // Navigate to first layout to establish a "previous" layout
    await navigateTo('/scroll-layout-a')
    await flushPromises()
    await expect.poll(() => pageLoadingEnd.mock.calls.length).toBeGreaterThan(0)

    // Wait for everything from first navigation to fully settle
    await expect.poll(() => scrollTo.mock.calls.length).toBeGreaterThan(0)
    vi.clearAllMocks()

    // Navigate to a different layout (triggers a layout transition)
    await navigateTo('/scroll-layout-b')
    await flushPromises()

    // Wait for all events to settle
    await expect.poll(() => layoutAfterLeave.mock.calls.length).toBeGreaterThan(0)
    await expect.poll(() => scrollTo.mock.calls.length).toBeGreaterThan(0)

    // scrollTo should fire AFTER the layout transition finishes (onAfterLeave),
    // not immediately when page:loading:end fires.
    expect(layoutAfterLeave).toHaveBeenCalledBefore(scrollTo)
  })
})

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const NestedPageParent = defineComponent({
  setup () {
    return () => h('div', [h(NuxtPage)])
  },
})

const SyncComponent = defineComponent({ setup: () => () => h('div') })
const AsyncComponent = defineComponent({
  async setup () {
    await sleep(10)
    return () => h('div')
  },
})
