/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { config, flushPromises } from '@vue/test-utils'
import { NuxtPage } from '#components'

config.global.stubs = {
  transition: false,
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper function to wait for conditions
const waitFor = async (condition: () => boolean, timeout = 1000) => {
  const start = Date.now()
  while (!condition() && Date.now() - start < timeout) {
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  if (!condition()) {
    throw new Error('Timeout waiting for condition')
  }
}

describe('scrollBehavior of router options with global transition', () => {
  const router = useRouter()
  const nuxtApp = useNuxtApp()

  let wrapper: VueWrapper<unknown>
  let scrollTo: ReturnType<typeof vi.spyOn>

  const pageTransitionFinish = vi.fn()
  const pageLoadingEnd = vi.fn()

  router.addRoute({
    name: 'transitions',
    path: '/transitions',
    component: defineComponent({ setup: () => () => h('div', [h(NuxtPage)]) }),
    children: [
      {
        name: 'transition-async',
        path: 'async',
        component: defineComponent({
          async setup () {
            await sleep(10)
            return () => h('div')
          },
        }),
      },
      {
        name: 'transition-sync',
        path: 'sync',
        component: defineComponent({ setup: () => () => h('div') }),
      },
    ],
  })

  beforeAll(async () => {
    nuxtApp.hook('page:transition:finish', pageTransitionFinish)
    nuxtApp.hook('page:loading:end', pageLoadingEnd)

    wrapper = await mountSuspended(defineComponent({
      setup: () => () => h(NuxtPage, {
        transition: {
          name: 'fade',
          mode: 'out-in',
          duration: 10,
        },
      }),
    }))
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
  })

  it('should call scrollTo after page transition is finished with async component', async () => {
    await navigateTo('/transitions/async')

    // Ensure everything is settled
    await waitFor(() => pageTransitionFinish.mock.calls.length > 0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should call scrollTo after page transition is finished with sync component', async () => {
    await navigateTo('/transitions/sync')

    // Ensure everything is settled
    await waitFor(() => pageTransitionFinish.mock.calls.length > 0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })
})
