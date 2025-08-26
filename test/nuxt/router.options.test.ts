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

  it('should call scrollTo after page transition is finished with async component', async () => {
    await navigateTo('/transitions/async')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should call scrollTo after page transition is finished with sync component', async () => {
    await navigateTo('/transitions/sync')

    // Ensure everything is settled
    await expect.poll(() => pageTransitionFinish.mock.calls.length).toBeGreaterThan(0)

    expect(pageTransitionFinish).toHaveBeenCalled()
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
