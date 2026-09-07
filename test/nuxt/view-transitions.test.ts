/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { NuxtPage } from '#components'
import viewTransitionsPlugin from '#app/plugins/view-transitions.client'

// jsdom doesn't implement document.startViewTransition or window.matchMedia,
// so both are stubbed before the plugin is installed.

const appViewTransition = vi.hoisted((): { enabled: boolean | 'always', types?: string[] } => ({ enabled: false }))

vi.mock('#build/nuxt.config.mjs', async original => ({
  ...await original<Record<string, unknown>>(),
  appViewTransition,
}))

type MockViewTransition = {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  types: Set<string>
  skipTransition: ReturnType<typeof vi.fn>
  runUpdate: () => Promise<void>
  settleFinished: () => void
  rejectReady: (reason: unknown) => void
}

type StartViewTransitionCallback = () => Promise<void>
interface StartViewTransitionOptions {
  update: () => Promise<void>
  types: string[]
}

describe('view transitions plugin', () => {
  let router: ReturnType<typeof useRouter>
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let startViewTransition: ReturnType<typeof vi.fn>
  let matchMediaMatches: boolean
  let autoRunUpdate: boolean
  let transitions: MockViewTransition[] = []

  const PageA = defineComponent({ name: '~/pages/vt-a.vue', setup: () => () => h('div', 'Page A') })
  const PageB = defineComponent({ name: '~/pages/vt-b.vue', setup: () => () => h('div', 'Page B') })

  // Per-test cleanups (hooks, routes added within a test)
  let testCleanups: Array<() => void> = []

  function createMockViewTransition (update: () => Promise<void>): MockViewTransition {
    let settleFinished!: () => void
    let rejectReady!: (reason: unknown) => void
    return {
      finished: new Promise<void>((resolve) => { settleFinished = resolve }),
      ready: new Promise<void>((_, reject) => { rejectReady = reject }),
      updateCallbackDone: Promise.resolve(),
      types: new Set(),
      skipTransition: vi.fn(),
      runUpdate: update,
      settleFinished,
      rejectReady,
    }
  }

  beforeAll(async () => {
    router = useRouter()
    nuxtApp = useNuxtApp()

    router.addRoute({
      name: 'vt-a',
      path: '/vt-a',
      component: PageA,
    })

    router.addRoute({
      name: 'vt-b',
      path: '/vt-b',
      component: PageB,
    })

    window.matchMedia = vi.fn(() => ({
      matches: matchMediaMatches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    document.startViewTransition = ((...args: unknown[]) => startViewTransition(...args)) as typeof document.startViewTransition

    await nuxtApp.runWithContext(() => viewTransitionsPlugin(nuxtApp))

    await mountSuspended(defineComponent({
      setup: () => () => h(NuxtPage),
    }))
    await flushPromises()
  })

  beforeEach(async () => {
    appViewTransition.enabled = false
    appViewTransition.types = undefined
    matchMediaMatches = false
    autoRunUpdate = true
    transitions = []

    await navigateTo('/')
    await flushPromises()
    vi.clearAllMocks()

    startViewTransition = vi.fn((callbackOrOptions: StartViewTransitionCallback | StartViewTransitionOptions) => {
      const update = typeof callbackOrOptions === 'function' ? callbackOrOptions : callbackOrOptions.update
      const transition = createMockViewTransition(update)
      transitions.push(transition)
      if (autoRunUpdate) {
        update()
      }
      return transition
    })
  })

  afterEach(() => {
    for (const cleanup of testCleanups) {
      cleanup()
    }
    testCleanups = []
  })

  afterAll(() => {
    router.removeRoute('vt-a')
    router.removeRoute('vt-b')
  })

  describe('transition skipping', () => {
    it('should not start a view transition when disabled', async () => {
      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).not.toHaveBeenCalled()
    })

    it('should not start a view transition when page meta disables it', async () => {
      appViewTransition.enabled = true

      router.addRoute({
        name: 'vt-disabled',
        path: '/vt-disabled',
        meta: { viewTransition: false },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-disabled'))

      await navigateTo('/vt-disabled')
      await flushPromises()

      expect(startViewTransition).not.toHaveBeenCalled()
    })

    it('should skip transition when prefers-reduced-motion is set', async () => {
      matchMediaMatches = true
      appViewTransition.enabled = true

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).not.toHaveBeenCalled()
    })

    it('should NOT skip transition when prefers-reduced-motion is set but mode is always', async () => {
      matchMediaMatches = true
      appViewTransition.enabled = 'always'

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalled()
    })

    it('should NOT skip when page meta sets always even if global is true', async () => {
      matchMediaMatches = true
      appViewTransition.enabled = true

      router.addRoute({
        name: 'vt-always',
        path: '/vt-always',
        meta: { viewTransition: 'always' },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-always'))

      await navigateTo('/vt-always')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalled()
    })
  })

  describe('callback vs object form', () => {
    it('should use callback form when no types are specified', async () => {
      appViewTransition.enabled = true

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0]
      expect(typeof arg).toBe('function')
    })

    it('should use object form when global types are specified', async () => {
      appViewTransition.enabled = true
      appViewTransition.types = ['slide']

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(typeof arg).toBe('object')
      expect(arg.types).toEqual(['slide'])
    })

    it('should use object form when page meta has types', async () => {
      appViewTransition.enabled = true

      router.addRoute({
        name: 'vt-typed',
        path: '/vt-typed',
        meta: {
          viewTransition: {
            enabled: true,
            types: ['fade'],
          },
        },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-typed'))

      await navigateTo('/vt-typed')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(arg.types).toEqual(['fade'])
    })
  })

  describe('type merging', () => {
    it('should merge types, toTypes and fromTypes', async () => {
      appViewTransition.enabled = true

      router.addRoute({
        name: 'vt-from-page',
        path: '/vt-from-page',
        meta: {
          viewTransition: {
            enabled: true,
            fromTypes: ['leaving'],
          },
        },
        component: PageA,
      })

      router.addRoute({
        name: 'vt-to-page',
        path: '/vt-to-page',
        meta: {
          viewTransition: {
            enabled: true,
            types: ['slide'],
            toTypes: ['entering'],
          },
        },
        component: PageB,
      })
      testCleanups.push(() => {
        router.removeRoute('vt-from-page')
        router.removeRoute('vt-to-page')
      })

      // Navigate to the "from" page first
      await navigateTo('/vt-from-page')
      await flushPromises()
      vi.clearAllMocks()

      // Navigate from vt-from-page -> vt-to-page
      await navigateTo('/vt-to-page')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      // types from "to" page + fromTypes from "from" page + toTypes from "to" page
      expect(arg.types).toEqual(['slide', 'leaving', 'entering'])
    })

    it('should support function types in page meta', async () => {
      appViewTransition.enabled = true

      router.addRoute({
        name: 'vt-fn-types',
        path: '/vt-fn-types',
        meta: {
          viewTransition: {
            enabled: true,
            types: (_to: unknown, _from: unknown) => ['dynamic-type'],
          },
        },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-fn-types'))

      await navigateTo('/vt-fn-types')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(arg.types).toEqual(['dynamic-type'])
    })

    it('should fall back to global types when page has no types', async () => {
      appViewTransition.enabled = true
      appViewTransition.types = ['global-slide']

      router.addRoute({
        name: 'vt-no-types',
        path: '/vt-no-types',
        meta: {
          viewTransition: { enabled: true },
        },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-no-types'))

      await navigateTo('/vt-no-types')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(arg.types).toEqual(['global-slide'])
    })

    it('page types should override global types', async () => {
      appViewTransition.enabled = true
      appViewTransition.types = ['global-slide']

      router.addRoute({
        name: 'vt-override',
        path: '/vt-override',
        meta: {
          viewTransition: {
            enabled: true,
            types: ['page-fade'],
          },
        },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-override'))

      await navigateTo('/vt-override')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(arg.types).toEqual(['page-fade'])
    })
  })

  describe('legacy page meta values', () => {
    it('should handle viewTransition: true in page meta', async () => {
      router.addRoute({
        name: 'vt-legacy-true',
        path: '/vt-legacy-true',
        meta: { viewTransition: true },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-legacy-true'))

      await navigateTo('/vt-legacy-true')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      // true is a legacy boolean value — should use callback form (no types)
      expect(typeof startViewTransition.mock.calls[0]![0]).toBe('function')
    })

    it('should handle viewTransition: "always" in page meta', async () => {
      matchMediaMatches = true

      router.addRoute({
        name: 'vt-legacy-always',
        path: '/vt-legacy-always',
        meta: { viewTransition: 'always' },
        component: PageA,
      })
      testCleanups.push(() => router.removeRoute('vt-legacy-always'))

      await navigateTo('/vt-legacy-always')
      await flushPromises()

      // 'always' should force transition even with prefers-reduced-motion
      expect(startViewTransition).toHaveBeenCalledTimes(1)
    })
  })

  describe('hooks and lifecycle', () => {
    it('should fire page:view-transition:start hook', async () => {
      appViewTransition.enabled = true

      const hookSpy = vi.fn()
      const removeHook = nuxtApp.hook('page:view-transition:start', hookSpy)
      testCleanups.push(removeHook)

      await navigateTo('/vt-a')
      await flushPromises()

      expect(hookSpy).toHaveBeenCalledTimes(1)
      expect(hookSpy).toHaveBeenCalledWith(transitions[0])
    })

    it('should resolve the update callback of a transition that interrupts an animating one', async () => {
      appViewTransition.enabled = true
      autoRunUpdate = false

      const firstNavigation = navigateTo('/vt-a')
      await vi.waitFor(() => expect(transitions).toHaveLength(1))
      const first = transitions[0]!
      const firstUpdate = first.runUpdate()
      await firstNavigation
      await firstUpdate
      expect(router.currentRoute.value.path).toBe('/vt-a')

      const secondNavigation = navigateTo('/vt-b')
      await vi.waitFor(() => expect(transitions).toHaveLength(2))
      const second = transitions[1]!

      first.settleFinished()
      await flushPromises()

      const secondUpdate = second.runUpdate()
      await secondNavigation
      await expect(Promise.race([secondUpdate, new Promise((_, reject) => setTimeout(() => reject(new Error('update callback never resolved')), 200))])).resolves.toBeUndefined()
      expect(router.currentRoute.value.path).toBe('/vt-b')
    })

    it('should settle the update callback of a transition whose navigation was superseded', async () => {
      appViewTransition.enabled = true
      autoRunUpdate = false

      const firstNavigation = navigateTo('/vt-a')
      await vi.waitFor(() => expect(transitions).toHaveLength(1))
      const firstUpdate = transitions[0]!.runUpdate()

      const secondNavigation = router.push('/vt-b')
      await vi.waitFor(() => expect(transitions).toHaveLength(2))
      const secondUpdate = transitions[1]!.runUpdate()

      await Promise.allSettled([firstNavigation, secondNavigation])
      await expect(Promise.race([firstUpdate, new Promise((_, reject) => setTimeout(() => reject(new Error('update callback never resolved')), 200))])).resolves.toBeUndefined()
      await expect(secondUpdate).resolves.toBeUndefined()
      expect(router.currentRoute.value.path).toBe('/vt-b')
    })
  })
})
