/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineEventHandler } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { hasProtocol } from 'ufo'
import { NavigationFailureType, isNavigationFailure } from 'vue-router'

import * as composables from '#app/composables'
import { _showErrorUnlessCrawler, clearError, showError, useError } from '#app/composables/error'
import { useNuxtApp } from '#app/nuxt'
import * as idleCallback from '#app/compat/idle-callback'
import { onNuxtReady } from '#app/composables/ready'
import { setResponseStatus, useRequestEvent, useRequestFetch, useRequestHeaders, useResponseHeader } from '#app/composables/ssr'
import { clearNuxtState, useState } from '#app/composables/state'
import { useRequestURL } from '#app/composables/url'
import { getAppManifest, getRouteRules } from '#app/composables/manifest'
import { callOnce } from '#app/composables/once'
import { useLoadingIndicator } from '#app/composables/loading-indicator'
import { useRouteAnnouncer } from '#app/composables/route-announcer'
import { useAnnouncer } from '#app/composables/announcer'
import { encodeRoutePath, encodeURL, resolveRouteObject } from '#app/composables/router'
import { useRuntimeHook } from '#app/composables/runtime-hook'
import { loadPayload, shouldLoadPayload } from '#app/composables/payload'
import { NuxtPage } from '#components'

import { isTestingAppManifest } from '../matrix'

registerEndpoint('/api/test', defineEventHandler(event => ({
  method: event.req.method,
  headers: Object.fromEntries(event.req.headers.entries()),
})))

// the test environment builds with `ssr: false`, which disables payload extraction
vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
}))

describe('app config', () => {
  it('can be updated', () => {
    const appConfig = useAppConfig()
    expect(appConfig).toStrictEqual({ nuxt: {} })

    type UpdateAppConfig = Parameters<typeof updateAppConfig>[0]

    const initConfig: UpdateAppConfig = {
      new: 'value',
      nuxt: { nested: 42 },
      regExp: /foo/g,
      date: new Date(1111, 11, 11),
      arr: [1, 2, 3],
    }
    updateAppConfig(initConfig)
    expect(appConfig).toStrictEqual(initConfig)

    const newConfig: UpdateAppConfig = {
      nuxt: { anotherNested: 24 },
      regExp: /bar/g,
      date: new Date(2222, 12, 12),
      arr: [4, 5],
    }
    updateAppConfig(newConfig)
    expect(appConfig).toStrictEqual({
      ...initConfig,
      ...newConfig,
      nuxt: { ...initConfig.nuxt, ...newConfig.nuxt },
      arr: [4, 5, 3],
    })
  })
})

describe('composables', () => {
  it('are all tested', () => {
    const testedComposables: string[] = [
      'useRouteAnnouncer',
      'useAnnouncer',
      'clearNuxtData',
      'refreshNuxtData',
      'useAsyncData',
      'useNuxtData',
      'createError',
      'isNuxtError',
      'clearError',
      'showError',
      'useError',
      'getAppManifest',
      'useHydration',
      'getRouteRules',
      'injectHead',
      'onNuxtReady',
      'callOnce',
      'setResponseStatus',
      'prerenderRoutes',
      'useRequestEvent',
      'useRequestFetch',
      'isPrerendered',
      'useRequestHeader',
      'useRequestHeaders',
      'useResponseHeader',
      'useLoadingIndicator',
      'useCookie',
      '$cookie',
      'clearNuxtState',
      'useState',
      'useRequestURL',
      'useRoute',
      'navigateTo',
      'abortNavigation',
      'setPageLayout',
      'defineNuxtComponent',
      'useRuntimeHook',
      'defineUseFetchAddon',
      'defineUseAsyncDataAddon',
    ]
    const skippedComposables: string[] = [
      'addRouteMiddleware',
      'defineNuxtRouteMiddleware',
      'definePayloadReducer',
      'definePayloadReviver',
      'loadPayload',
      'onBeforeRouteLeave',
      'onBeforeRouteUpdate',
      'prefetchComponents',
      'preloadComponents',
      'preloadPayload',
      'preloadRouteComponents',
      'reloadNuxtApp',
      'refreshCookie',
      'onPrehydrate',
      'useId',
      'useFetch',
      'useHead',
      'useHeadSafe',
      'useServerHead',
      'useServerHeadSafe',
      'useServerSeoMeta',
      'useLazyFetch',
      'useLazyAsyncData',
      'useRouter',
      'useSeoMeta',
      'usePreviewMode',
      'useLayout',
    ]
    expect(Object.keys(composables).sort()).toEqual([...new Set([...testedComposables, ...skippedComposables])].sort())
  })
})

describe('errors', () => {
  it('global nuxt errors', () => {
    const error = useError()
    expect(error.value).toBeUndefined()
    showError('new error')
    expect(error.value).toMatchInlineSnapshot('[HTTPError: new error]')
    clearError()
    expect(error.value).toBe(undefined)
  })

  describe('_showErrorUnlessCrawler', () => {
    afterEach(async () => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
      await clearError()
    })

    it('shows the error page for a regular user agent', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' })
      const error = useError()
      await _showErrorUnlessCrawler(useNuxtApp(), new Error('chunk failed'))
      expect(error.value).toMatchInlineSnapshot('[HTTPError: chunk failed]')
    })

    it('suppresses the error page and fires `app:error` for a crawler', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const appError = vi.fn()
      const nuxtApp = useNuxtApp()
      const off = nuxtApp.hook('app:error', appError)

      const error = useError()
      await _showErrorUnlessCrawler(nuxtApp, new Error('chunk failed'))

      expect(error.value).toBeUndefined()
      expect(appError).toHaveBeenCalledWith(expect.objectContaining({ message: 'chunk failed' }))
      off()
    })
  })
})

describe('onNuxtReady', () => {
  function stubIdleCallback (isHydrating: boolean, implementation?: typeof idleCallback.requestIdleCallback) {
    const nuxtApp = useNuxtApp()
    const wasHydrating = nuxtApp.isHydrating
    nuxtApp.isHydrating = isHydrating
    const requestIdleCallback = vi.spyOn(idleCallback, 'requestIdleCallback')
    if (implementation) {
      requestIdleCallback.mockImplementation(implementation)
    }
    onTestFinished(() => {
      nuxtApp.isHydrating = wasHydrating
      requestIdleCallback.mockRestore()
    })
    return { nuxtApp, requestIdleCallback }
  }

  const runIdle: typeof idleCallback.requestIdleCallback = (cb) => { cb({ didTimeout: true, timeRemaining: () => 0 }); return 0 }

  it('should call callback once nuxt is hydrated', async () => {
    const fn = vi.fn()
    onNuxtReady(fn)
    await new Promise(resolve => setTimeout(resolve, 1))
    expect(fn).toHaveBeenCalled()
  })

  it('should pass the timeout to requestIdleCallback', () => {
    const { requestIdleCallback } = stubIdleCallback(false, runIdle)
    const fn = vi.fn()
    onNuxtReady(fn, { timeout: 500 })
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 })
    expect(fn).toHaveBeenCalledOnce()
  })

  it('should pass the timeout to requestIdleCallback after hydration', async () => {
    const { nuxtApp, requestIdleCallback } = stubIdleCallback(true, runIdle)
    const fn = vi.fn()
    onNuxtReady(fn, { timeout: 500 })
    expect(requestIdleCallback).not.toHaveBeenCalled()
    await nuxtApp.hooks.callHook('app:suspense:resolve')
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 })
    expect(fn).toHaveBeenCalledOnce()
  })

  it('should not schedule the callback if the signal is already aborted', () => {
    const { requestIdleCallback } = stubIdleCallback(false)
    onNuxtReady(() => {}, { signal: AbortSignal.abort() })
    expect(requestIdleCallback).not.toHaveBeenCalled()
  })

  it('should not run the callback if the signal is aborted during hydration', async () => {
    const { nuxtApp } = stubIdleCallback(true, runIdle)
    const fn = vi.fn()
    const controller = new AbortController()
    onNuxtReady(fn, { signal: controller.signal })
    controller.abort()
    await nuxtApp.hooks.callHook('app:suspense:resolve')
    expect(fn).not.toHaveBeenCalled()
  })

  it('should not run the callback if the signal is aborted while waiting for idle', () => {
    let idle: IdleRequestCallback | undefined
    stubIdleCallback(false, (cb) => { idle = cb; return 0 })
    const fn = vi.fn()
    const controller = new AbortController()
    onNuxtReady(fn, { signal: controller.signal })
    controller.abort()
    expect(idle).toBeDefined()
    idle?.({ didTimeout: false, timeRemaining: () => 50 })
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('ssr composables', () => {
  it('work on client', () => {
    // @ts-expect-error This should work for backward compatibility
    expect(setResponseStatus()).toBeUndefined()
    expect(useRequestEvent()).toBeUndefined()
    expect(useRequestFetch()).toEqual($fetch)
    expect(useRequestHeaders()).toEqual({})
    expect(prerenderRoutes('/')).toBeUndefined()
    expect(useResponseHeader('x-test').value).toBeUndefined()
  })
})

describe('useHydration', () => {
  it('should hydrate value from payload', async () => {
    let val: any
    const nuxtApp = useNuxtApp()
    useHydration('key', () => {}, (fromPayload) => { val = fromPayload })
    await nuxtApp.hooks.callHook('app:created', nuxtApp.vueApp)
    expect(val).toMatchInlineSnapshot('undefined')

    nuxtApp.payload.key = 'from payload'
    await nuxtApp.hooks.callHook('app:created', nuxtApp.vueApp)
    expect(val).toMatchInlineSnapshot('"from payload"')
  })
})

describe('useState', () => {
  // be sure to not have colliding keys in tests
  afterEach(() => {
    clearNuxtState(undefined, { reset: false })
  })

  it('expect providing only init function to use autoKey default', () => {
    expect(useState(() => 'default').value).toBe('default')
  })

  it('expect state in nuxtApp payload to be registered', () => {
    useState('key', () => 'value')
    expect(Object.entries(useNuxtApp().payload.state)).toContainEqual(['$skey', 'value'])
  })

  it('expect state to be a plain ref and not nested', () => {
    const state1 = useState('key', () => ref({
      test: 1,
    }))
    expect(isRef(state1)).toBeTruthy()
    expect(isRef(state1.value)).toBeFalsy()
  })

  it('expect same state is provided with the same ref', () => {
    const state1 = useState('key', () => ref({
      test: 1,
    }))
    const state2 = useState('key', () => ref({
      test: 2,
    }))
    state1.value.test = 3
    expect(state1.value).toBe(state2.value)
  })
})

describe('clearNuxtState', () => {
  // be sure to not have colliding keys in tests
  afterEach(() => {
    clearNuxtState(undefined, { reset: false })
  })

  it('expect state in payload for single key to be removed', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    expect(state.value).toBe('test')
    clearNuxtState(key)
    expect(state.value).toBe('test')
  })

  it('expect state in payload for array of keys to be removed', () => {
    const key1 = 'clearNuxtState-test'
    const key2 = 'clearNuxtState-test2'
    const state1 = useState(key1, () => 'test')
    const state2 = useState(key2, () => 'test')
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    clearNuxtState([key1, 'other'])
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    clearNuxtState([key1, key2])
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
  })

  it('expect state in payload for function to be removed', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    expect(state.value).toBe('test')
    clearNuxtState(() => false)
    expect(state.value).toBe('test')
    clearNuxtState(k => k === key)
    expect(state.value).toBe('test')
  })

  it('expect all states to be removed when no key is provided', () => {
    const state1 = useState('clearNuxtState-test', () => 'test')
    const state2 = useState('clearNuxtState-test2', () => 'test')
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    clearNuxtState(undefined)
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
  })

  it('expect state in payload for single key to reset', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    state.value = 'test-2'
    expect(state.value).toBe('test-2')
    clearNuxtState(key, { reset: true })
    expect(state.value).toBe('test')
  })

  it('expect state in payload for array of keys to reset ', () => {
    const key1 = 'clearNuxtState-test'
    const key2 = 'clearNuxtState-test2'
    const state1 = useState(key1, () => 'test')
    const state2 = useState(key2, () => 'test')
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    state1.value = 'test-2'
    state2.value = 'test-2'
    clearNuxtState([key1, 'other'], { reset: true })
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test-2')
    clearNuxtState([key1, key2], { reset: true })
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
  })

  it('expect ref-initialised state to reset', () => {
    const key = 'clearNuxtState-ref'
    const state = useState(key, () => ref('test'))
    state.value = 'test-2'
    clearNuxtState(key, { reset: true })
    expect(state.value).toBe('test')
  })

  it('expect ref-initialised state to clear', () => {
    const key = 'clearNuxtState-ref-2'
    const state = useState(key, () => ref('test'))
    clearNuxtState(key, { reset: false })
    expect(state.value).toBeUndefined()
  })

  it('expect state in payload for function to reset', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    expect(state.value).toBe('test')
    clearNuxtState(() => false, { reset: true })
    expect(state.value).toBe('test')
    state.value = 'test-2'
    clearNuxtState(k => k === key, { reset: true })
    expect(state.value).toBe('test')
  })

  it('expect all states to reset when no key is provided', () => {
    const state1 = useState('clearNuxtState-test', () => 'test')
    const state2 = useState('clearNuxtState-test2', () => 'test')
    state1.value = 'test-2'
    state2.value = 'test-2'
    expect(state1.value).toBe('test-2')
    expect(state2.value).toBe('test-2')
    clearNuxtState(undefined, { reset: true })
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
  })

  it('expect fetching state twice to reset both', () => {
    const state1 = useState('clearNuxtState-test', () => 'test')
    const state2 = useState('clearNuxtState-test', () => 'test')
    state1.value = 'test-2'
    expect(state1.value).toBe('test-2')
    expect(state2.value).toBe('test-2')
    clearNuxtState(undefined, { reset: true })
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
  })

  it('expect fetching state after reset has init value', () => {
    const state1 = useState('clearNuxtState-test', () => 'test')
    state1.value = 'test-2'
    expect(state1.value).toBe('test-2')
    const state2 = useState('clearNuxtState-test', () => 'test')
    expect(state2.value).toBe('test-2')
    clearNuxtState(undefined, { reset: true })
    expect(state1.value).toBe('test')
    const state3 = useState('clearNuxtState-test', () => 'test')
    expect(state3.value).toBe('test')
  })

  it('should only enumerate useState keys, ignoring internal payload.state entries', () => {
    const nuxtApp = useNuxtApp()
    // Simulate internal state entries that don't use the useState prefix
    nuxtApp.payload.state._layout = 'default'
    nuxtApp.payload.state._layoutProps = { foo: 'bar' }

    const state = useState('clearNuxtState-test', () => 'test')
    expect(state.value).toBe('test')

    const matchedKeys: string[] = []
    clearNuxtState((key) => {
      matchedKeys.push(key)
      return true
    })

    // Filter function should only receive actual useState keys, not garbled internal keys
    expect(matchedKeys).not.toContain('ayout')
    expect(matchedKeys).not.toContain('ayoutProps')
    expect(matchedKeys).toContain('clearNuxtState-test')

    // Internal state entries should not be affected
    expect(nuxtApp.payload.state._layout).toBe('default')
    expect(nuxtApp.payload.state._layoutProps).toEqual({ foo: 'bar' })

    // Clean up
    delete nuxtApp.payload.state._layout
    delete nuxtApp.payload.state._layoutProps
  })

  it('removes the key from payload.state rather than setting it to undefined', () => {
    const nuxtApp = useNuxtApp()
    const key = 'clearNuxtState-test'
    useState(key, () => 'test')
    expect(`$s${key}` in nuxtApp.payload.state).toBe(true)

    clearNuxtState(key, { reset: false })

    expect(`$s${key}` in nuxtApp.payload.state).toBe(false)
  })
})

describe('url', () => {
  it('useRequestURL', () => {
    const url = useRequestURL()
    expect(url).toMatchInlineSnapshot('"http://localhost:3000/"')
    expect(url.hostname).toMatchInlineSnapshot('"localhost"')
    expect(url.port).toMatchInlineSnapshot('"3000"')
    expect(url.protocol).toMatchInlineSnapshot('"http:"')
  })
})

describe('loading state', () => {
  it('expect loading state to be changed by hooks', async () => {
    vi.useFakeTimers()
    const nuxtApp = useNuxtApp()
    const { isLoading } = useLoadingIndicator()
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeFalsy()
    await nuxtApp.callHook('page:loading:start')
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeTruthy()

    await nuxtApp.callHook('page:loading:end')
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeFalsy()
    vi.useRealTimers()
  })

  it('expect loading state to be changed by force starting/stoping', async () => {
    vi.useFakeTimers()
    const nuxtApp = useNuxtApp()
    const { isLoading, start, finish } = useLoadingIndicator()
    expect(isLoading.value).toBeFalsy()
    await nuxtApp.callHook('page:loading:start')
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeTruthy()
    start()
    expect(isLoading.value).toBeTruthy()
    finish()
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeFalsy()
    vi.useRealTimers()
  })

  it('expect error from loading state to be changed by finish({ error: true })', async () => {
    vi.useFakeTimers()
    const nuxtApp = useNuxtApp()
    const { error, start, finish } = useLoadingIndicator()
    expect(error.value).toBeFalsy()
    await nuxtApp.callHook('page:loading:start')
    start()
    finish({ error: true })
    expect(error.value).toBeTruthy()
    start()
    expect(error.value).toBeFalsy()
    finish()
    vi.useRealTimers()
  })

  it('expect state from set opts: { force: true }', async () => {
    vi.useFakeTimers()
    const nuxtApp = useNuxtApp()
    const { isLoading, start, finish, set } = useLoadingIndicator()
    await nuxtApp.callHook('page:loading:start')
    start({ force: true })
    expect(isLoading.value).toBeTruthy()
    finish()
    vi.advanceTimersToNextTimer()
    expect(isLoading.value).toBeFalsy()
    set(0, { force: true })
    expect(isLoading.value).toBeTruthy()
    set(100, { force: true })
    expect(isLoading.value).toBeFalsy()
    vi.useRealTimers()
  })

  it('clears a pending hide timeout when setting progress', () => {
    vi.useFakeTimers()
    const { clear, finish, isLoading, set } = useLoadingIndicator()

    try {
      finish()
      vi.advanceTimersByTime(100)
      set(30, { force: true })
      clear()
      vi.advanceTimersByTime(400)

      expect(isLoading.value).toBe(true)
    } finally {
      finish({ force: true })
      vi.useRealTimers()
    }
  })

  it('clears a pending reset timeout when setting progress', () => {
    vi.useFakeTimers()
    const { clear, finish, progress, set } = useLoadingIndicator()

    try {
      finish()
      vi.advanceTimersByTime(500)
      set(30, { force: true })
      clear()
      vi.advanceTimersByTime(400)

      expect(progress.value).toBe(30)
    } finally {
      finish({ force: true })
      vi.useRealTimers()
    }
  })
})

describe.skipIf(!isTestingAppManifest)('app manifests', () => {
  it('getAppManifest', async () => {
    const manifest = await getAppManifest()
    // @ts-expect-error timestamp is not optional
    delete manifest.timestamp
    expect(manifest).toMatchInlineSnapshot(`
      {
        "id": "test",
        "matcher": {
          "dynamic": {},
          "static": {
            "/cafÉ": {
              "redirect": "/accented-target",
            },
            "/pre-encoded/%E6%B5%8B%E8%AF%95": {
              "redirect": "/pre-encoded-target",
            },
            "/pre/test": {
              "redirect": "/",
            },
            "/specific-prerendered": {
              "prerender": true,
            },
            "/unicode/测试": {
              "ssr": false,
            },
            "/测试": {
              "redirect": "/unicode-target",
            },
          },
          "wildcard": {
            "/isr": {
              "isr": 60,
            },
            "/pre": {
              "prerender": true,
            },
            "/pre/spa": {
              "prerender": true,
              "ssr": false,
            },
            "/unicode": {
              "ssr": true,
            },
          },
        },
        "prerendered": [],
      }
    `)
  })
  it('getRouteRules', () => {
    expect(getRouteRules({ path: '/' })).toMatchInlineSnapshot(`
      {
        "ssr": true,
      }
    `)
    expect(getRouteRules({ path: '/pre' })).toMatchInlineSnapshot(`
      {
        "prerender": true,
        "ssr": true,
      }
    `)
    expect(getRouteRules({ path: '/pre/spa/thing' })).toMatchInlineSnapshot(`
      {
        "prerender": true,
        "ssr": false,
      }
    `)
    expect(getRouteRules({ path: '/pre/test' })).toMatchInlineSnapshot(`
      {
        "prerender": true,
        "redirect": "/",
        "ssr": true,
      }
    `)
  })
  it('matches route-rule casing consistently with vue-router', () => {
    const spaRules = getRouteRules({ path: '/Pre/spa/thing' })
    const redirectRules = getRouteRules({ path: '/PRE/test' })

    expect(spaRules).not.toHaveProperty('prerender')
    expect(redirectRules).not.toHaveProperty('redirect')
  })
})

describe('unicode route rules', () => {
  it('applies a decoded rule key to the encoded request path', () => {
    for (const path of ['/测试', `/${encodeURIComponent('测试')}`, `/${encodeURIComponent('测试').toLowerCase()}`]) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/unicode-target' })
    }
  })

  it('prefers a specific unicode rule over a catch-all covering the same key', () => {
    for (const path of ['/unicode/测试', `/unicode/${encodeURIComponent('测试')}`]) {
      expect(getRouteRules({ path }), path).toMatchObject({ ssr: false })
    }
  })

  it('applies a rule key authored in encoded form', () => {
    for (const path of [`/pre-encoded/${encodeURIComponent('测试')}`, '/pre-encoded/测试']) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/pre-encoded-target' })
    }
  })

  it('applies a rule key whose casing matches the request exactly', () => {
    for (const path of ['/cafÉ', `/caf${encodeURIComponent('É')}`]) {
      expect(getRouteRules({ path }), path).toMatchObject({ redirect: '/accented-target' })
    }
    for (const path of ['/café', `/caf${encodeURIComponent('é')}`]) {
      expect(getRouteRules({ path }), path).not.toHaveProperty('redirect')
    }
  })
})

describe('encoded slash route rules', () => {
  it('applies rules for the path with encoded slashes as separators', () => {
    for (const path of ['/pre%2Ftest', '/pre%2ftest']) {
      expect(getRouteRules({ path }), path).toMatchObject({ prerender: true, redirect: '/' })
    }
    for (const path of ['/pre/spa%2Fthing', '/pre%2Fspa%2Fthing']) {
      expect(getRouteRules({ path }), path).toMatchObject({ ssr: false })
    }
  })

  it('does not treat a double-encoded slash as a separator', () => {
    expect(getRouteRules({ path: '/pre%252Ftest' })).not.toHaveProperty('redirect')
  })
})

describe('compiled route rules', () => {
  it('isPrerendered', async () => {
    expect(await isPrerendered('/specific-prerendered')).toBeTruthy()
    expect(await isPrerendered('/prerendered/test')).toBeFalsy()
    expect(await isPrerendered('/test')).toBeFalsy()
    expect(await isPrerendered('/pre/test')).toBeFalsy()
    expect(await isPrerendered('/pre/thing')).toBeTruthy()
    expect(await isPrerendered('/pre/spa/thing')).toBeTruthy()
  })

  it('should determine if payload should be loaded based on route rules', async () => {
    // wildcard routes with prerender: true should load payloads
    const shouldLoadPre = await shouldLoadPayload('/pre/thing')
    expect(shouldLoadPre).toBe(true)

    // prerendered routes with ssr: false should not load payloads
    const shouldLoadSpaPre = await shouldLoadPayload('/pre/spa/thing')
    expect(shouldLoadSpaPre).toBe(false)

    // specific prerendered routes should load payloads
    const shouldLoadSpecific = await shouldLoadPayload('/specific-prerendered')
    expect(shouldLoadSpecific).toBe(true)

    // routes with redirect should not load payloads
    const redirectRoute = getRouteRules({ path: '/pre/test' })
    expect(redirectRoute.redirect).toBe('/')
    const shouldLoadRedirect = await shouldLoadPayload('/pre/test')
    expect(shouldLoadRedirect).toBe(false)
  })

  it('should only use `force-cache` for immutable prerendered payloads', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('[{"data":1},{}]')))
    try {
      await loadPayload('/pre/thing')
      expect(fetchSpy.mock.calls[0]![1]).toMatchObject({ cache: 'force-cache' })

      // cached (isr/swr/cache) payloads can change within a deploy, so the browser cache must be revalidated
      await loadPayload('/isr/thing')
      expect(fetchSpy.mock.calls[1]![1]).toMatchObject({ cache: 'default' })

      await loadPayload('/isr/thing?page=2')
      expect(fetchSpy.mock.calls[2]![1]).toMatchObject({ cache: 'default' })
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('useRuntimeHook', () => {
  it('types work', () => {
    // @ts-expect-error should not allow unknown hooks
    useRuntimeHook('test', () => {})
    useRuntimeHook('app:beforeMount', (_app) => {
      // @ts-expect-error argument should be typed
      _app = 'test'
    })
  })

  it('should call hooks', async () => {
    const nuxtApp = useNuxtApp()
    let called = 1
    const wrapper = await mountSuspended(defineNuxtComponent({
      setup () {
        useRuntimeHook('test-hook' as any, () => {
          called++
        })
      },
      render: () => h('div', 'hi there'),
    }))
    expect(called).toBe(1)
    await nuxtApp.callHook('test-hook' as any)
    expect(called).toBe(2)
    wrapper.unmount()
    await nuxtApp.callHook('test-hook' as any)
    expect(called).toBe(2)
  })
})

describe('routing utilities: `navigateTo`', () => {
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let router: ReturnType<typeof useRouter>

  beforeEach(() => {
    nuxtApp = useNuxtApp()
    router = useRouter()
  })

  function waitForPageChange () {
    return vi.waitFor(() => new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve())))
  }

  it('matches routes case-sensitively', () => {
    router.addRoute({ name: 'case-sensitive-test', path: '/case-sensitive-test', component: defineComponent({}) })
    expect(router.resolve('/Case-Sensitive-Test').name).not.toBe('case-sensitive-test')
    router.removeRoute('case-sensitive-test')
  })

  it('navigateTo should disallow navigation to external URLs by default', () => {
    expect(() => navigateTo('https://test.com')).toThrowErrorMatchingInlineSnapshot(`[NUXT_E2001: https://nuxt.com/docs/5.x/errors/e2001]`)
    expect(() => navigateTo('https://test.com', { external: true })).not.toThrow()
    expect(() => navigateTo('/\t/test.com')).toThrow(expect.objectContaining({ code: 'NUXT_E2001' }))
    expect(() => navigateTo('/\n\\test.com')).toThrow(expect.objectContaining({ code: 'NUXT_E2001' }))
  })
  it('navigateTo should disallow navigation to data/script URLs', () => {
    const urls = [
      ['data:alert("hi")', 'data'],
      ['\0data:alert("hi")', 'data'],
    ]
    for (const [url] of urls) {
      expect(() => navigateTo(url, { external: true })).toThrow(expect.objectContaining({ code: 'NUXT_E2002' }))
    }
  })
  it('navigateTo should disallow opening data/script URLs via the `open` option', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      const urls = [
        'javascript:alert("hi")',
        'data:alert("hi")',
        'vbscript:alert("hi")',
        '\0javascript:alert("hi")',
      ]
      for (const url of urls) {
        expect(() => navigateTo(url, { open: { target: '_blank' } })).toThrow(expect.objectContaining({ code: 'NUXT_E2002' }))
      }
      expect(open).not.toHaveBeenCalled()
    } finally {
      open.mockRestore()
    }
  })
  it('navigateTo should still allow opening safe URLs via the `open` option', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      expect(() => navigateTo('https://example.com', { open: { target: '_blank' } })).not.toThrow()
      expect(open).toHaveBeenCalledWith('https://example.com', '_blank', '')
    } finally {
      open.mockRestore()
    }
  })

  it('navigateTo should default `open.target` to `_blank`', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    try {
      navigateTo('https://example.com', { open: {} })
      expect(open).toHaveBeenCalledWith('https://example.com', '_blank', '')
    } finally {
      open.mockRestore()
    }
  })

  it('navigateTo should respect app.baseURL when opening internal routes', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const config = useRuntimeConfig()
    const originalBaseURL = config.app.baseURL
    config.app.baseURL = '/docs/'
    try {
      navigateTo('/guide', { open: { target: '_blank' } })
      expect(open).toHaveBeenCalledWith('/docs/guide', '_blank', '')

      navigateTo({ path: '/guide' }, { open: { target: '_blank' } })
      expect(open).toHaveBeenCalledWith('/docs/guide', '_blank', '')

      navigateTo('https://example.com', { open: { target: '_blank' } })
      expect(open).toHaveBeenCalledWith('https://example.com', '_blank', '')
    } finally {
      config.app.baseURL = originalBaseURL
      open.mockRestore()
    }
  })

  it('reloadNuxtApp should disallow paths with data/script URLs', () => {
    const urls = [
      'javascript:alert("hi")',
      'data:alert("hi")',
      '\0data:alert("hi")',
    ]
    for (const url of urls) {
      expect(() => reloadNuxtApp({ path: url })).toThrow(expect.objectContaining({ code: 'NUXT_E2010' }))
    }
  })
  it('reloadNuxtApp should disallow cross-origin paths', () => {
    const urls = [
      '//evil.com',
      'https://evil.com',
      '\\\\evil.com',
      `${window.location.protocol === 'https:' ? 'http:' : 'https:'}//${window.location.host}/legit/path`,
    ]
    for (const url of urls) {
      expect(() => reloadNuxtApp({ path: url })).toThrow(expect.objectContaining({ code: 'NUXT_E2010' }))
    }
  })
  it('reloadNuxtApp should allow same-origin paths', () => {
    expect(() => reloadNuxtApp({ path: '/legit/path' })).not.toThrow()
  })
  it('navigateTo should replace current navigation state if called within middleware', () => {
    const nuxtApp = useNuxtApp()
    nuxtApp._processingMiddleware = true
    expect(navigateTo('/')).toMatchInlineSnapshot(`"/"`)
    expect(navigateTo('/', { replace: true })).toMatchInlineSnapshot(`
      {
        "path": "/",
        "replace": true,
      }
    `)
    nuxtApp._processingMiddleware = false
  })

  it('#28425', async () => {
    router.addRoute({
      name: 'slug',
      path: '/28425/:slug',
      component: defineComponent({
        template: '<div> slug page </div>',
        async setup () {
          await new Promise(res => setTimeout(res, 200))
        },
      }),
    })
    const el = await mountSuspended({ setup: () => () => h(NuxtPage) })
    const route = useRoute()
    await navigateTo('/28425/p1') // remove this line to prevent the issue.
    await navigateTo('/28425/p1')
    await navigateTo('/28425/p2')
    await navigateTo('/28425/p3')
    await waitForPageChange()
    expect(el.html()).toContain('<div> slug page </div>')
    expect(route.fullPath).toMatchInlineSnapshot(`"/28425/p3"`)
    el.unmount()
    router.removeRoute('slug')
  })

  it('should navigate when called outside middleware while a navigation is pending', async () => {
    const router = useRouter()
    let release!: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    let enter!: () => void
    const entered = new Promise<void>((resolve) => { enter = resolve })
    const removeGuard = router.beforeResolve(async (to) => {
      if (to.query.section === 'roles') {
        enter()
        await blocked
      }
    })

    try {
      const older = navigateTo({ path: '/', query: { section: 'roles' } })
      await entered
      await navigateTo({ path: '/', query: { section: 'employment' } })
      release()
      await older
    } finally {
      removeGuard()
    }

    expect(router.currentRoute.value.query.section).toBe('employment')
  })

  it('should redirect from middleware while an earlier navigation is being cancelled', async () => {
    const router = useRouter()
    let releaseFirst!: () => void
    const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve })
    let releaseSecond!: () => void
    const secondBlocked = new Promise<void>((resolve) => { releaseSecond = resolve })
    let enterSecond!: () => void
    const secondEntered = new Promise<void>((resolve) => { enterSecond = resolve })
    const middleware = defineNuxtRouteMiddleware(async (to) => {
      if (to.query.race === 'first') {
        await firstBlocked
      }
      if (to.query.race === 'second') {
        enterSecond()
        await secondBlocked
        return navigateTo({ path: '/', query: { race: 'redirected' } })
      }
    })
    addRouteMiddleware(middleware, { global: true })

    try {
      const first = router.push({ path: '/', query: { race: 'first' } })
      const second = router.push({ path: '/', query: { race: 'second' } })
      await secondEntered
      releaseFirst()
      await first
      releaseSecond()
      await second
    } finally {
      const globalMiddleware = useNuxtApp()._middleware.global
      globalMiddleware.splice(globalMiddleware.indexOf(middleware), 1)
    }

    expect(router.currentRoute.value.query.race).toBe('redirected')
    expect(router.currentRoute.value.redirectedFrom?.query.race).toBe('second')
  })
})

describe('routing utilities: `resolveRouteObject`', () => {
  it('resolveRouteObject should correctly resolve a route object', () => {
    expect(resolveRouteObject({ path: '/test' })).toMatchInlineSnapshot(`"/test"`)
    expect(resolveRouteObject({ path: '/test', hash: '#thing', query: { foo: 'bar' } })).toMatchInlineSnapshot(`"/test?foo=bar#thing"`)
  })
})

describe('routing utilities: `encodeURL`', () => {
  const encode = (url: string) => {
    const isExternal = hasProtocol(url, { acceptRelative: true })
    return encodeURL(url, isExternal)
  }
  it('encodeURL should correctly encode a URL', () => {
    expect(encode('https://test.com')).toMatchInlineSnapshot(`"https://test.com/"`)
    expect(encode('//test.com')).toMatchInlineSnapshot(`"//test.com/"`)
    expect(encode('mailto:daniel@cœur.com')).toMatchInlineSnapshot(`"mailto:daniel@c%C5%93ur.com"`)
    const encoded = encode('/cœur?redirected=' + encodeURIComponent('https://google.com'))
    expect(new URL('/cœur', 'http://localhost').pathname).toMatchInlineSnapshot(`"/c%C5%93ur"`)
    expect(encoded).toMatchInlineSnapshot(`"/c%C5%93ur?redirected=https%3A%2F%2Fgoogle.com"`)
    expect(useRouter().resolve(encoded).query.redirected).toMatchInlineSnapshot(`"https://google.com"`)
  })

  it.each([
    '/..//evil.com',
    '/.//evil.com',
    '/%2e%2e//evil.com',
    '/app/..//evil.com',
    '/..//evil.com/path?q=1#h',
  ])('does not produce a protocol-relative URL for path-normalization bypass %s', (input) => {
    const result = encode(input)
    expect(result.startsWith('//')).toBe(false)
    expect(new URL(result, 'http://app.test').origin).toBe('http://app.test')
  })
})

describe('routing utilities: `encodeRoutePath`', () => {
  it('should encode decoded unicode paths', () => {
    expect(encodeRoutePath('/café')).toBe(`/${encodeURIComponent('café')}`)
    expect(encodeRoutePath('/测试')).toBe(`/${encodeURIComponent('测试')}`)
    expect(encodeRoutePath('/товары')).toBe(`/${encodeURIComponent('товары')}`)
  })

  it('should not double-encode already-encoded paths', () => {
    const encoded = `/${encodeURIComponent('café')}`
    expect(encodeRoutePath(encoded)).toBe(encoded)
    expect(encodeRoutePath('/%E6%B5%8B%E8%AF%95')).toBe('/%E6%B5%8B%E8%AF%95')
  })

  it('should preserve query and hash', () => {
    expect(encodeRoutePath('/café?q=foo')).toBe(`/${encodeURIComponent('café')}?q=foo`)
    expect(encodeRoutePath('/café?q=foo#bar')).toBe(`/${encodeURIComponent('café')}?q=foo#bar`)
  })

  it('should leave sub-delimiters literal, as vue-router does', () => {
    expect(encodeRoutePath('/a&b')).toBe('/a&b')
    expect(encodeRoutePath('/a+b')).toBe('/a+b')
    expect(encodeRoutePath('/a[b]')).toBe('/a[b]')
    expect(encodeRoutePath('/normal')).toBe('/normal')
  })

  it('should preserve encoded slashes', () => {
    expect(encodeRoutePath('/a%2Fb')).toBe('/a%2Fb')
  })
})

describe('routing utilities: `navigateTo` path encoding', () => {
  it('should encode decoded unicode paths for vue-router', async () => {
    const router = useRouter()
    const push = vi.spyOn(router, 'push')
    await navigateTo('/café')
    expect(push).toHaveBeenCalledWith(`/${encodeURIComponent('café')}`)
    push.mockRestore()
  })

  it('should not double-encode already-encoded paths', async () => {
    const router = useRouter()
    const push = vi.spyOn(router, 'push')
    const encoded = `/${encodeURIComponent('café')}`
    await navigateTo(encoded)
    expect(push).toHaveBeenCalledWith(encoded)
    push.mockRestore()
  })

  it('should not encode object locations', async () => {
    const router = useRouter()
    const push = vi.spyOn(router, 'push')
    const to = { path: '/test', query: { foo: 'bar' } }
    await navigateTo(to)
    expect(push).toHaveBeenCalledWith(to)
    push.mockRestore()
  })
})

describe('routing utilities: `useRoute`', () => {
  let nuxtApp: ReturnType<typeof useNuxtApp>
  let router: ReturnType<typeof useRouter>

  beforeEach(() => {
    nuxtApp = useNuxtApp()
    router = useRouter()
  })

  function waitForPageChange () {
    return new Promise<void>(resolve => nuxtApp.hooks.hookOnce('page:finish', () => resolve()))
  }

  afterEach(() => {
    router.clearRoutes()
  })

  it('should provide a route', async () => {
    await navigateTo('/')
    expect(useRoute()).toMatchObject({
      fullPath: '/',
      hash: '',
      matched: expect.arrayContaining([]),
      meta: {},
      name: 'catchall',
      params: {},
      path: '/',
      query: {},
      redirectedFrom: undefined,
    })
  })

  it('should sync route after child suspense resolves', async () => {
    router.addRoute({
      name: 'parent-test',
      path: '/parent',
      component: defineComponent({
        setup: () => () => h('div', ['parent', h(NuxtPage)]),
      }),
      children: [
        {
          name: 'parent',
          path: '',
          component: defineComponent({
            template: '<div> parent/index </div>',
          }),
        },
        {
          name: 'parent-suspense',
          path: 'suspense',
          component: defineComponent({
            template: '<div> parent/suspense </div>',
            setup: () => new Promise(resolve => setTimeout(resolve, 1)),
          }),
        },
      ],
    })

    const el = await mountSuspended({ setup: () => () => h(NuxtPage) })
    const route = useRoute()

    await navigateTo('/parent')
    await waitForPageChange()

    expect(el.html()).toContain('<div> parent/index </div>')
    expect(route.name).toBe('parent')

    await navigateTo('/parent/suspense')

    expect(el.html()).toContain('<div> parent/index </div>')
    expect(route.name).toBe('parent')

    await waitForPageChange()

    expect(el.html()).toContain('<div> parent/suspense </div>')
    expect(route.name).toBe('parent-suspense')

    el.unmount()
    router.removeRoute('parent-test')
  })

  it('should update a route created in a detached scope across navigation', async () => {
    // minimal `createSharedComposable` from the reproduction in #18903
    let sharedRoute: ReturnType<typeof useRoute> | undefined
    const useSharedRoute = () => (sharedRoute ||= effectScope(true).run(() => useRoute())!)

    let injectedRoute: ReturnType<typeof useRoute>
    let childScopeRoute: ReturnType<typeof useRoute>

    router.addRoute({
      name: 'shared-a',
      path: '/shared-a',
      component: defineComponent({
        template: '<div />',
        setup: () => {
          injectedRoute = useRoute()
          childScopeRoute = effectScope().run(() => useRoute())!
          useSharedRoute()
        },
      }),
    })
    router.addRoute({
      name: 'shared-b',
      path: '/shared-b',
      component: defineComponent({ template: '<div />' }),
    })

    const el = await mountSuspended({ setup: () => () => h(NuxtPage) })

    await navigateTo('/shared-a')
    await waitForPageChange()
    expect(sharedRoute!.name).toBe('shared-a')

    await navigateTo('/shared-b?q=test')
    await waitForPageChange()
    // the detached scope outlives the page, so it follows the current route
    expect(sharedRoute!.name).toBe('shared-b')
    expect(sharedRoute!.query).toMatchObject({ q: 'test' })
    // routes obtained within the page's own scope stay frozen at that page's route
    expect(injectedRoute!.name).toBe('shared-a')
    expect(childScopeRoute!.name).toBe('shared-a')

    el.unmount()
    router.removeRoute('shared-a')
    router.removeRoute('shared-b')
  })
})

describe('routing utilities: `abortNavigation`', () => {
  it('should throw an error if one is provided', () => {
    const error = useError()
    expect(() => abortNavigation({ message: 'Page not found' })).toThrowErrorMatchingInlineSnapshot('[HTTPError: Page not found]')
    expect(error.value).toBe(undefined)
  })
  it('should block navigation if no error is provided', () => {
    expect(abortNavigation()).toMatchInlineSnapshot('false')
  })
  it('should abort navigation from a router guard in development', async () => {
    vi.stubGlobal('__TEST_DEV__', true)
    const router = useRouter()
    const removeGuard = router.beforeEach(to => to.query.abortGuard ? abortNavigation() : undefined)
    try {
      const failure = await router.push('/?abortGuard=1')
      expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true)
    } finally {
      removeGuard()
      vi.unstubAllGlobals()
    }
  })

  describe('aborted navigation', () => {
    const abortMiddleware = defineNuxtRouteMiddleware(to => to.query.abort ? abortNavigation() : undefined)
    let restoreRoutes = () => {}

    beforeEach(() => {
      const router = useRouter()
      const catchall = router.getRoutes().find(route => route.name === 'catchall')
      if (catchall) {
        router.removeRoute('catchall')
      }
      router.addRoute({ name: 'abort-matched', path: '/abort-matched', component: defineComponent({ template: '<div />' }) })
      restoreRoutes = () => {
        router.removeRoute('abort-matched')
        if (catchall) {
          router.addRoute(catchall)
        }
      }
      addRouteMiddleware(abortMiddleware, { global: true })
    })

    afterEach(async () => {
      const globalMiddleware = useNuxtApp()._middleware.global
      globalMiddleware.splice(globalMiddleware.indexOf(abortMiddleware), 1)
      await clearError()
      await navigateTo('/abort-matched')
      restoreRoutes()
    })

    it('should not show a 404 for an unmatched route', async () => {
      const error = useError()
      await navigateTo('/abort-unmatched?abort=1')
      expect(error.value).toBeUndefined()
    })

    it.each(['/abort-matched?abort=1', '/abort-unmatched-2?abort=1'])('should keep the current error when navigating to %s', async (target) => {
      const error = useError()
      await navigateTo('/abort-unmatched')
      expect(error.value?.message).toBe('Page not found: /abort-unmatched')

      await navigateTo(target)
      expect(error.value?.message).toBe('Page not found: /abort-unmatched')
    })
  })
})

describe('routing utilities: `setPageLayout`', () => {
  it('should set layout on page metadata if run outside middleware', () => {
    const route = useRoute()
    expect(route.meta.layout).toBeUndefined()
    setPageLayout('custom')
    expect(route.meta.layout).toEqual('custom')
    route.meta.layout = undefined
  })

  it('should not set layout directly if run within middleware', () => {
    const route = useRoute()
    const nuxtApp = useNuxtApp()
    nuxtApp._processingMiddleware = true
    setPageLayout('custom')
    expect(route.meta.layout).toBeUndefined()
    nuxtApp._processingMiddleware = false
  })

  it('should set layout on the target route if run within a router guard', async () => {
    const router = useRouter()
    router.addRoute({
      name: 'layout-guard-test',
      path: '/layout-guard-test',
      component: defineComponent({ template: '<div />' }),
    })
    const from = router.currentRoute.value
    const removeGuard = router.beforeEach((to) => {
      if (to.path === '/layout-guard-test') {
        setPageLayout('custom')
      }
    })
    try {
      await router.push('/layout-guard-test')
    } finally {
      removeGuard()
      router.removeRoute('layout-guard-test')
    }
    expect(from.meta.layout).toBeUndefined()
    expect(router.currentRoute.value.meta.layout).toBe('custom')
  })

  it.each([
    ['to the current route', ['/?layoutRedirect=current']],
    ['through another route to the current route', ['/?layoutRedirect=hop', '/?layoutRedirect=current']],
  ])('should set layout on page metadata after middleware redirects %s', async (_, targets) => {
    const router = useRouter()
    const route = useRoute()
    await router.push('/')
    const middleware = defineNuxtRouteMiddleware((to) => {
      if (to.query.layoutRedirect === 'hop') {
        return navigateTo('/?layoutRedirect=current')
      }
      if (to.query.layoutRedirect === 'current') {
        return navigateTo('/')
      }
    })
    addRouteMiddleware(middleware, { global: true })
    try {
      await router.push(targets[0]!)
    } finally {
      const globalMiddleware = useNuxtApp()._middleware.global
      globalMiddleware.splice(globalMiddleware.indexOf(middleware), 1)
    }
    expect(route.fullPath).toBe('/')
    setPageLayout('custom')
    expect(route.meta.layout).toBe('custom')
    route.meta.layout = undefined
  })

  it('should preserve layout and props on same-path (query-only) navigation', async () => {
    const router = useRouter()
    router.addRoute({
      name: 'layout-props-test',
      path: '/layout-props-test',
      component: defineComponent({ template: '<div />' }),
    })
    await router.push('/layout-props-test')
    const route = useRoute()
    setPageLayout('with-props', { someProp: 'hello' })
    expect(route.meta.layout).toEqual('with-props')
    expect(route.meta.layoutProps).toEqual({ someProp: 'hello' })
    await router.push({ query: { tab: 'b' } })
    expect(route.meta.layout).toEqual('with-props')
    expect(route.meta.layoutProps).toEqual({ someProp: 'hello' })
    router.removeRoute('layout-props-test')
  })
})

describe('callOnce', () => {
  describe.each([
    ['without options', undefined],
    ['with "render" option', { mode: 'render' as const }],
    ['with "navigation" option', { mode: 'navigation' as const }],
  ])('%s', (_name, options) => {
    let nuxtApp: ReturnType<typeof useNuxtApp>
    beforeEach(() => {
      nuxtApp = useNuxtApp()
    })
    afterEach(() => {
      nuxtApp.payload.once.clear()
    })
    it('should only call composable once', async () => {
      const fn = vi.fn()
      const execute = () => options ? callOnce(fn, options) : callOnce(fn)
      await execute()
      await execute()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should only call composable once when called in parallel', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1)))
      const execute = () => options ? callOnce(fn, options) : callOnce(fn)
      await Promise.all([execute(), execute(), execute()])
      expect(fn).toHaveBeenCalledTimes(1)

      const fnSync = vi.fn().mockImplementation(() => {})
      const executeSync = () => options ? callOnce(fnSync, options) : callOnce(fnSync)
      await Promise.all([executeSync(), executeSync(), executeSync()])
      expect(fnSync).toHaveBeenCalledTimes(1)
    })

    it('should use key to dedupe', async () => {
      const fn = vi.fn()
      const execute = (key?: string) => options ? callOnce(key, fn, options) : callOnce(key, fn)
      await execute('first')
      await execute('first')
      await execute('second')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it.runIf(options?.mode === 'navigation')('should rerun on navigation', async () => {
      const fn = vi.fn()
      const execute = () => options ? callOnce(fn, options) : callOnce(fn)
      await execute()
      await execute()
      expect(fn).toHaveBeenCalledTimes(1)

      await navigateTo('/test')
      await execute()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it.runIf(options?.mode === 'navigation')('should rerun on every consecutive navigation', async () => {
      const fn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1)))
      const execute = () => options ? callOnce('consecutive-nav', fn, options) : callOnce('consecutive-nav', fn)

      // First execution with page:start firing during async fn (simulates Suspense.onPending)
      const p1 = execute()
      await nuxtApp.callHook('page:start')
      await p1
      expect(fn).toHaveBeenCalledTimes(1)

      // First navigation
      await navigateTo('/page-2')
      const p2 = execute()
      await nuxtApp.callHook('page:start')
      await p2
      expect(fn).toHaveBeenCalledTimes(2)

      // Second navigation - should NOT be skipped
      await navigateTo('/page-3')
      const p3 = execute()
      await nuxtApp.callHook('page:start')
      await p3
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should retry after a rejected promise', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce(undefined)
      const execute = () => options ? callOnce('retry-key', fn, options) : callOnce('retry-key', fn)
      await expect(execute()).rejects.toThrow('fail')
      expect(fn).toHaveBeenCalledTimes(1)

      await execute()
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})

describe.each([
  { name: 'useRouteAnnouncer', useAnnouncer: useRouteAnnouncer, resetsOnDispose: false },
  { name: 'useAnnouncer', useAnnouncer, resetsOnDispose: true },
])('$name', ({ useAnnouncer, resetsOnDispose }) => {
  it('should default to polite politeness', () => {
    expect(useAnnouncer().politeness.value).toBe('polite')
  })

  it('should accept a politeness', () => {
    expect(useAnnouncer({ politeness: 'assertive' }).politeness.value).toBe('assertive')
  })

  it('should set message and politeness', () => {
    const announcer = useAnnouncer()
    announcer.set('Test message with politeness', 'assertive')
    expect(announcer.message.value).toBe('Test message with politeness')
    expect(announcer.politeness.value).toBe('assertive')

    announcer.polite('Test message polite')
    expect(announcer.message.value).toBe('Test message polite')
    expect(announcer.politeness.value).toBe('polite')

    announcer.assertive('Test message assertive')
    expect(announcer.message.value).toBe('Test message assertive')
    expect(announcer.politeness.value).toBe('assertive')
  })

  it('should share the announcer until the last scope using it is disposed', () => {
    const scope1 = effectScope()
    const scope2 = effectScope()
    const announcer = scope1.run(() => useAnnouncer())!
    expect(scope2.run(() => useAnnouncer())).toBe(announcer)
    announcer.assertive('Still in use')

    scope1.stop()
    expect(useAnnouncer()).toBe(announcer)
    expect(announcer.message.value).toBe('Still in use')

    scope2.stop()
    expect(announcer.message.value).toBe(resetsOnDispose ? '' : 'Still in use')
    expect(useAnnouncer()).not.toBe(announcer)
  })
})

describe('namespace access to useNuxtApp', () => {
  it('should return the nuxt instance when used with correct appId', () => {
    const nuxtApp = useNuxtApp()
    expect(useNuxtApp(nuxtApp._id)).toBe(nuxtApp)
  })

  it('should throw an error when used with wrong appId', () => {
    expect(() => useNuxtApp('nuxt-app-unknown')).toThrow()
  })
})
