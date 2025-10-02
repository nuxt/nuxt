/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { NuxtPage } from '#components'

describe('scrollBehavior of router options with global transition', () => {
  const router = useRouter()
  const nuxtApp = useNuxtApp()

  let wrapper: VueWrapper<unknown>
  let scrollTo: ReturnType<typeof vi.spyOn>
  const cleanups: Array<() => void> = []

  const pageTransitionFinish = vi.fn()
  const pageLoadingEnd = vi.fn()

  router.addRoute({
    name: 'transitions',
    path: '/transitions',
    component: NestedPageParent,
    children: [{ path: 'async', component: AsyncComponent }, { path: 'sync', component: SyncComponent }],
  })

  async function completeNavigation () {
    await flushPromises()

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
  }

  beforeAll(async () => {
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
    scrollTo.mockClear()

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

  it('should set _runningTransition after page:start and be deleted after page:loading:end with async component', async () => {
    let runningTransitionAtStart: boolean | undefined
    let runningTransitionAtLoadingEnd: boolean | undefined

    const pageStartSpy = vi.fn(() => {
      runningTransitionAtStart = nuxtApp._runningTransition as boolean
    })
    const pageLoadingEndSpy = vi.fn(() => {
      runningTransitionAtLoadingEnd = nuxtApp._runningTransition as undefined
    })

    cleanups.push(nuxtApp.hook('page:start', pageStartSpy))
    cleanups.push(nuxtApp.hook('page:loading:end', pageLoadingEndSpy))

    await navigateTo('/transitions/async')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    // Verify _runningTransition is true at page:start
    expect(runningTransitionAtStart).toBe(true)
    // Verify _runningTransition is still true at page:loading:end (not deleted yet)
    expect(runningTransitionAtLoadingEnd).toBeUndefined()
    // Verify _runningTransition is deleted after page:loading:end completes
    expect(nuxtApp._runningTransition).toBeUndefined()
    expect(pageStartSpy).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should set _runningTransition after page:start and be deleted after page:loading:end with sync component', async () => {
    let runningTransitionAtStart: boolean | undefined
    let runningTransitionAtLoadingEnd: boolean | undefined

    const pageStartSpy = vi.fn(() => {
      runningTransitionAtStart = nuxtApp._runningTransition as boolean
    })
    const pageLoadingEndSpy = vi.fn(() => {
      runningTransitionAtLoadingEnd = nuxtApp._runningTransition as undefined
    })

    cleanups.push(nuxtApp.hook('page:start', pageStartSpy))
    cleanups.push(nuxtApp.hook('page:loading:end', pageLoadingEndSpy))

    await navigateTo('/transitions/sync')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    // Verify _runningTransition is true at page:start
    expect(runningTransitionAtStart).toBe(true)
    // Verify _runningTransition is still true at page:loading:end (not deleted yet)
    expect(runningTransitionAtLoadingEnd).toBeUndefined()
    // Verify _runningTransition is deleted after page:loading:end completes
    expect(nuxtApp._runningTransition).toBeUndefined()
    // Verify pageLoadingEnd and scrollTo are also called
    expect(pageStartSpy).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
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
