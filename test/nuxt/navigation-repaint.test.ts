/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { NuxtPage } from '#components'
import viewTransitionsPlugin from '#app/plugins/view-transitions.client'
import navigationRepaintPlugin from '#app/plugins/navigation-repaint.client'

const appViewTransition = vi.hoisted((): { enabled: boolean | 'always' } => ({ enabled: true }))

vi.mock('#build/nuxt.config.mjs', async original => ({
  ...await original<Record<string, unknown>>(),
  appViewTransition,
}))

describe('navigation repaint with view transitions', () => {
  let router: ReturnType<typeof useRouter>
  let renderingSuppressed = false
  let pendingFrames: FrameRequestCallback[] = []
  let framesRequested = 0
  let framesRequestedWhileSuppressed = 0
  let transitionsStarted = 0

  const PageA = defineComponent({ name: '~/pages/nr-a.vue', setup: () => () => h('div', 'Page A') })
  const PageB = defineComponent({ name: '~/pages/nr-b.vue', setup: () => () => h('div', 'Page B') })

  // like the browser, no frame is produced between the update callback being invoked and settling
  function startViewTransition (update: () => Promise<void>) {
    transitionsStarted++
    const updateCallbackDone = new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        renderingSuppressed = true
        update().then(resolve, reject)
      })
    })
    const resumeRendering = () => {
      renderingSuppressed = false
      const frames = pendingFrames
      pendingFrames = []
      for (const frame of frames) {
        setTimeout(() => frame(performance.now()))
      }
    }
    updateCallbackDone.then(resumeRendering, resumeRendering)
    return { updateCallbackDone, ready: updateCallbackDone, finished: updateCallbackDone, types: new Set(), skipTransition: () => {} }
  }

  beforeAll(async () => {
    router = useRouter()
    const nuxtApp = useNuxtApp()

    router.addRoute({ name: 'nr-a', path: '/nr-a', component: PageA })
    router.addRoute({ name: 'nr-b', path: '/nr-b', meta: { viewTransition: false }, component: PageB })

    window.matchMedia = vi.fn(() => ({ matches: false })) as unknown as typeof window.matchMedia
    document.startViewTransition = startViewTransition as unknown as typeof document.startViewTransition
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      framesRequested++
      if (renderingSuppressed) {
        framesRequestedWhileSuppressed++
        pendingFrames.push(callback)
      } else {
        setTimeout(() => callback(performance.now()))
      }
      return 0
    })

    // same order as in an app: the view transition guard is registered first
    await nuxtApp.runWithContext(() => viewTransitionsPlugin(nuxtApp))
    await nuxtApp.runWithContext(() => navigationRepaintPlugin(nuxtApp))

    await mountSuspended(defineComponent({
      setup: () => () => h(NuxtPage),
    }))
    await flushPromises()
  })

  beforeEach(async () => {
    await navigateTo('/')
    await flushPromises()
    await vi.waitFor(() => expect(renderingSuppressed).toBe(false))
    framesRequested = 0
    framesRequestedWhileSuppressed = 0
    transitionsStarted = 0
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    router.removeRoute('nr-a')
    router.removeRoute('nr-b')
  })

  it('does not wait for a frame while a view transition is running', async () => {
    const start = performance.now()
    await navigateTo('/nr-a')
    const elapsed = performance.now() - start
    const framesAwaitedByNavigation = framesRequestedWhileSuppressed
    await flushPromises()

    expect(transitionsStarted).toBe(1)
    expect(router.currentRoute.value.path).toBe('/nr-a')
    expect(framesAwaitedByNavigation).toBe(0)
    expect(elapsed).toBeLessThan(100)
  })

  it('waits for a frame again once the view transition has finished', async () => {
    await navigateTo('/nr-b')
    await flushPromises()
    expect(transitionsStarted).toBe(0)
    const framesWithoutTransition = framesRequested

    await navigateTo('/nr-a')
    await flushPromises()
    await vi.waitFor(() => expect(renderingSuppressed).toBe(false))
    expect(transitionsStarted).toBe(1)

    framesRequested = 0
    await navigateTo('/nr-b')
    await flushPromises()

    expect(framesWithoutTransition).toBeGreaterThan(0)
    expect(framesRequested).toBe(framesWithoutTransition)
  })
})
