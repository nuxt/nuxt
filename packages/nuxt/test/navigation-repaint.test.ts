import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { NuxtApp, Plugin, RuntimeNuxtHooks } from '../src/app/nuxt'
import navigationRepaintPlugin from '../src/app/plugins/navigation-repaint.client'
import viewTransitionsPlugin from '../src/app/plugins/view-transitions.client'

const { useRouter, onNuxtReady } = vi.hoisted(() => ({
  useRouter: vi.fn(),
  onNuxtReady: vi.fn(),
}))

vi.mock('../src/app/nuxt', () => ({ defineNuxtPlugin: (plugin: Plugin) => plugin }))
vi.mock('../src/app/composables/router', () => ({ useRouter }))
vi.mock('../src/app/composables/ready', () => ({ onNuxtReady }))
vi.mock('#build/nuxt.config.mjs', () => ({ appViewTransition: { enabled: true } }))

describe('navigation repaint with view transitions', () => {
  let router: ReturnType<typeof createRouter>
  let nuxtApp: NuxtApp
  let prefersReducedMotion: boolean
  let requestFrame: ReturnType<typeof vi.fn>
  let startViewTransition: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.useFakeTimers()
    prefersReducedMotion = false
    requestFrame = vi.fn()
    const hooks = createHooks<RuntimeNuxtHooks>()
    nuxtApp = { hook: hooks.hook, callHook: hooks.callHook } as NuxtApp
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: {} },
        { path: '/other', component: {} },
        { path: '/disabled', component: {}, meta: { viewTransition: false } },
      ],
    })
    await router.push('/')
    useRouter.mockReturnValue(router)
    startViewTransition = vi.fn((update: () => Promise<void>) => {
      const updateCallbackDone = Promise.resolve().then(update)
      return {
        updateCallbackDone,
        ready: updateCallbackDone,
        finished: updateCallbackDone,
        skipTransition: vi.fn(),
      }
    })
    vi.stubGlobal('document', { visibilityState: 'visible', startViewTransition })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      matchMedia: () => ({ matches: prefersReducedMotion }),
    })
    vi.stubGlobal('requestAnimationFrame', requestFrame)
  })

  async function installPlugins () {
    await viewTransitionsPlugin(nuxtApp)
    await navigationRepaintPlugin(nuxtApp)
    onNuxtReady.mock.lastCall![0]()
  }

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('resolves navigation without waiting for a frame during a view transition', async () => {
    await installPlugins()
    const navigated = vi.fn()
    const navigation = router.push('/other').then(navigated)
    await vi.advanceTimersByTimeAsync(0)

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(requestFrame).not.toHaveBeenCalled()
    expect(navigated).toHaveBeenCalledOnce()
    await navigation
    await nuxtApp.callHook('page:finish')
  })

  it.each(['disabled', 'reduced motion', 'unsupported'] as const)('still waits for a frame when transitions are %s', async (mode) => {
    prefersReducedMotion = mode === 'reduced motion'
    if (mode === 'unsupported') {
      document.startViewTransition = undefined as unknown as typeof document.startViewTransition
    }
    await installPlugins()
    const navigated = vi.fn()
    const navigation = router.push(mode === 'disabled' ? '/disabled' : '/other').then(navigated)
    await vi.advanceTimersByTimeAsync(0)

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(requestFrame).toHaveBeenCalledOnce()
    expect(navigated).not.toHaveBeenCalled()
    requestFrame.mock.lastCall![0]()
    await vi.advanceTimersByTimeAsync(0)
    await navigation
    expect(navigated).toHaveBeenCalledOnce()
  })

  it.each(['page:finish', 'app:error'] as const)('restores repainting after %s', async (hook) => {
    await installPlugins()
    const navigation = router.push('/other')
    await vi.advanceTimersByTimeAsync(0)
    expect(requestFrame).not.toHaveBeenCalled()
    await navigation
    if (hook === 'app:error') {
      await nuxtApp.callHook(hook, new Error('page setup failed'))
    } else {
      await nuxtApp.callHook(hook)
    }
    await vi.advanceTimersByTimeAsync(0)

    const nextNavigation = router.push('/disabled')
    await vi.advanceTimersByTimeAsync(0)
    expect(requestFrame).toHaveBeenCalledOnce()
    requestFrame.mock.lastCall![0]()
    await vi.advanceTimersByTimeAsync(0)
    await nextNavigation
  })

  it('keeps skipping repaint when an older update settles during a newer transition', async () => {
    await installPlugins()
    const first = Promise.withResolvers<void>()
    const second = Promise.withResolvers<void>()
    await nuxtApp.callHook('page:view-transition:start', { updateCallbackDone: first.promise } as ViewTransition)
    await nuxtApp.callHook('page:view-transition:start', { updateCallbackDone: second.promise } as ViewTransition)
    first.resolve()
    await vi.advanceTimersByTimeAsync(0)

    const navigated = vi.fn()
    const navigation = router.push('/disabled').then(navigated)
    await vi.advanceTimersByTimeAsync(0)
    expect(requestFrame).not.toHaveBeenCalled()
    expect(navigated).toHaveBeenCalledOnce()
    await navigation
    second.resolve()
  })
})
