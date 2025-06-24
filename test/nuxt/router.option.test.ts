/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
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

describe('scrollBehavior of router options', () => {
  const router = useRouter()
  const nuxtApp = useNuxtApp()

  let scrollTo: ReturnType<typeof vi.spyOn>

  const addRoute = (sync: boolean) => {
    router.addRoute({
      name: 'slug',
      path: '/:slug(.*)*',
      component: defineComponent({
        name: '~/pages/[...slug].vue',
        ...(sync
          ? {
              setup: () => () => h('div'),
            }
          : {
              async setup () {
                await sleep(10)
                return () => h('div')
              },
            }
        ),

      }),
    })
  }

  beforeEach(() => {
    scrollTo = vi.spyOn(globalThis, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    router.removeRoute('slug')
    vi.clearAllMocks()
    scrollTo.mockClear()
  })

  it('should call scrollTo after page transition is finished with async component', async () => {
    addRoute(false)

    await mountSuspended({
      setup: () => () => h(NuxtPage, {
        transition: {
          name: 'fade',
          mode: 'out-in',
          duration: 10,
        },
      }),
    })

    await flushPromises()

    const pageTransitionFinish = vi.fn()
    const pageLoadingEnd = vi.fn()

    nuxtApp.hook('page:transition:finish', pageTransitionFinish)
    nuxtApp.hook('page:loading:end', pageLoadingEnd)

    await router.push('/page')

    // Ensure everything is settled
    await waitFor(() => pageTransitionFinish.mock.calls.length > 0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })

  it('should call scrollTo after page transition is finished with sync component', async () => {
    addRoute(true)

    await mountSuspended({
      setup: () => () => h(NuxtPage, {
        transition: {
          name: 'fade',
          mode: 'out-in',
          duration: 10,
        },
      }),
    })

    await flushPromises()

    const pageTransitionFinish = vi.fn()
    const pageLoadingEnd = vi.fn()

    nuxtApp.hook('page:transition:finish', pageTransitionFinish)
    nuxtApp.hook('page:loading:end', pageLoadingEnd)

    await router.push('/page')

    // Ensure everything is settled
    await waitFor(() => pageTransitionFinish.mock.calls.length > 0)

    expect(pageTransitionFinish).toHaveBeenCalled()
    expect(pageLoadingEnd).toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalled()
    expect(pageTransitionFinish).toHaveBeenCalledBefore(scrollTo)
  })
})
