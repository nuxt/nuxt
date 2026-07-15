/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { NuxtPage } from '#components'

// We test the view-transitions plugin behavior by manually registering
// a beforeResolve guard that mirrors the plugin's logic, with mocked
// document.startViewTransition. This is necessary because:
// 1. The basic fixture doesn't enable experimental.viewTransition
// 2. jsdom doesn't implement document.startViewTransition

type MockViewTransition = {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  types: Set<string>
  skipTransition: ReturnType<typeof vi.fn>
  _resolveFinished: () => void
}

function createMockViewTransition (): MockViewTransition {
  let resolveFinished: () => void
  const finished = new Promise<void>((resolve) => { resolveFinished = resolve })
  return {
    finished,
    ready: Promise.resolve(),
    updateCallbackDone: Promise.resolve(),
    types: new Set(),
    skipTransition: vi.fn(),
    _resolveFinished: resolveFinished!,
  }
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
  let mockTransition: MockViewTransition
  let matchMediaMatches: boolean
  const cleanups: Array<() => void> = []

  const PageA = defineComponent({ name: '~/pages/vt-a.vue', setup: () => () => h('div', 'Page A') })
  const PageB = defineComponent({ name: '~/pages/vt-b.vue', setup: () => () => h('div', 'Page B') })

  // Per-test cleanups (guards, hooks, routes added within a test)
  let testCleanups: Array<() => void> = []

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

    await mountSuspended(defineComponent({
      setup: () => () => h(NuxtPage),
    }))
    await flushPromises()
  })

  beforeEach(async () => {
    await navigateTo('/')
    await flushPromises()
    vi.clearAllMocks()

    mockTransition = createMockViewTransition()
    matchMediaMatches = false

    startViewTransition = vi.fn((callbackOrOptions: StartViewTransitionCallback | StartViewTransitionOptions) => {
      // Execute the update callback to allow route change to proceed
      if (typeof callbackOrOptions === 'function') {
        callbackOrOptions()
      } else {
        callbackOrOptions.update()
      }
      return mockTransition
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
    for (const cleanup of cleanups) {
      cleanup()
    }
  })

  // Helper to install the view transition plugin behavior with given config
  function installViewTransitionGuard (defaultConfig: { enabled: boolean | 'always', types?: string[] }) {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(() => ({
      matches: matchMediaMatches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    // Track finishTransition so page:finish can call it
    let finishTransition: (() => void) | undefined

    const removeGuard = router.beforeResolve(async (to, from) => {
      if (to.matched.length === 0) { return }

      const normalizeOptions = (value: unknown): Record<string, unknown> => {
        if (typeof value === 'boolean' || value === 'always') {
          return { enabled: value }
        }
        if (value && typeof value === 'object') {
          return value as Record<string, unknown>
        }
        return {}
      }

      const toOpts = normalizeOptions(to.meta.viewTransition)
      const fromOpts = normalizeOptions(from.meta.viewTransition)
      const viewTransitionMode = toOpts.enabled ?? defaultConfig.enabled
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const prefersNoTransition = prefersReducedMotion && viewTransitionMode !== 'always'

      if (
        viewTransitionMode === false
        || prefersNoTransition
        || to.path === from.path
      ) {
        return
      }

      const resolveTypes = (types: unknown) => {
        if (!types) { return undefined }
        return typeof types === 'function' ? (types as (to: unknown, from: unknown) => string[])(to, from) : types as string[]
      }

      const viewTransitionBaseTypes = resolveTypes(toOpts.types) ?? resolveTypes(defaultConfig.types) ?? []
      const viewTransitionFromTypes = resolveTypes(fromOpts.fromTypes) ?? []
      const viewTransitionToTypes = resolveTypes(toOpts.toTypes) ?? []

      const allTypes = [
        ...(viewTransitionBaseTypes as string[]),
        ...(viewTransitionFromTypes as string[]),
        ...(viewTransitionToTypes as string[]),
      ]

      const promise = new Promise<void>((resolve) => {
        finishTransition = resolve
      })

      let changeRoute: () => void
      const ready = new Promise<void>(resolve => (changeRoute = resolve))

      const update = () => {
        changeRoute()
        return promise
      }

      if (allTypes.length > 0) {
        startViewTransition({ update, types: allTypes })
      } else {
        startViewTransition(update)
      }

      await nuxtApp.callHook('page:view-transition:start', mockTransition as unknown as ViewTransition)

      return ready
    })

    const removeFinishHook = nuxtApp.hook('page:finish', () => {
      finishTransition?.()
      finishTransition = undefined
    })

    testCleanups.push(removeGuard, removeFinishHook, () => matchMediaSpy.mockRestore())

    return { removeGuard, removeFinishHook, matchMediaSpy }
  }

  describe('transition skipping', () => {
    it('should not start a view transition when disabled', async () => {
      installViewTransitionGuard({ enabled: false })

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).not.toHaveBeenCalled()
    })

    it('should not start a view transition when page meta disables it', async () => {
      installViewTransitionGuard({ enabled: true })

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
      installViewTransitionGuard({ enabled: true })

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).not.toHaveBeenCalled()
    })

    it('should NOT skip transition when prefers-reduced-motion is set but mode is always', async () => {
      matchMediaMatches = true
      installViewTransitionGuard({ enabled: 'always' })

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalled()
    })

    it('should NOT skip when page meta sets always even if global is true', async () => {
      matchMediaMatches = true
      installViewTransitionGuard({ enabled: true })

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
      installViewTransitionGuard({ enabled: true })

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0]
      expect(typeof arg).toBe('function')
    })

    it('should use object form when global types are specified', async () => {
      installViewTransitionGuard({ enabled: true, types: ['slide'] })

      await navigateTo('/vt-a')
      await flushPromises()

      expect(startViewTransition).toHaveBeenCalledTimes(1)
      const arg = startViewTransition.mock.calls[0]![0] as StartViewTransitionOptions
      expect(typeof arg).toBe('object')
      expect(arg.types).toEqual(['slide'])
    })

    it('should use object form when page meta has types', async () => {
      installViewTransitionGuard({ enabled: true })

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
      installViewTransitionGuard({ enabled: true })

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
      installViewTransitionGuard({ enabled: true })

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
      installViewTransitionGuard({ enabled: true, types: ['global-slide'] })

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
      installViewTransitionGuard({ enabled: true, types: ['global-slide'] })

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
      installViewTransitionGuard({ enabled: false })

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
      installViewTransitionGuard({ enabled: false })

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
      installViewTransitionGuard({ enabled: true })

      const hookSpy = vi.fn()
      const removeHook = nuxtApp.hook('page:view-transition:start', hookSpy)
      testCleanups.push(removeHook)

      await navigateTo('/vt-a')
      await flushPromises()

      expect(hookSpy).toHaveBeenCalledTimes(1)
      expect(hookSpy).toHaveBeenCalledWith(mockTransition)
    })
  })
})
