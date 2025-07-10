/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'
import { destr } from 'destr'

import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import { hasProtocol, withQuery } from 'ufo'
import { flushPromises } from '@vue/test-utils'
import { Transition } from 'vue'
import { createClientPage } from '../../packages/nuxt/src/components/runtime/client-component'
import * as composables from '#app/composables'

import type { NuxtApp } from '#app/nuxt'
import { clearNuxtData, refreshNuxtData, useAsyncData, useNuxtData } from '#app/composables/asyncData'
import { clearError, createError, isNuxtError, showError, useError } from '#app/composables/error'
import { onNuxtReady } from '#app/composables/ready'
import { setResponseStatus, useRequestEvent, useRequestFetch, useRequestHeaders, useResponseHeader } from '#app/composables/ssr'
import { clearNuxtState, useState } from '#app/composables/state'
import { useRequestURL } from '#app/composables/url'
import { getAppManifest, getRouteRules } from '#app/composables/manifest'
import { callOnce } from '#app/composables/once'
import { useLoadingIndicator } from '#app/composables/loading-indicator'
import { useRouteAnnouncer } from '#app/composables/route-announcer'
import { encodeURL, resolveRouteObject } from '#app/composables/router'
import { useRuntimeHook } from '#app/composables/runtime-hook'

registerEndpoint('/api/test', defineEventHandler(event => ({
  method: event.method,
  headers: Object.fromEntries(event.headers.entries()),
})))

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
      'useRequestHeaders',
      'useResponseHeader',
      'useCookie',
      'clearNuxtState',
      'useState',
      'useRequestURL',
      'useRoute',
      'navigateTo',
      'abortNavigation',
      'setPageLayout',
      'defineNuxtComponent',
      'useRuntimeHook',
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
      'useLazyFetch',
      'useLazyAsyncData',
      'useRouter',
      'useSeoMeta',
      'useServerHead',
      'useServerHeadSafe',
      'useServerSeoMeta',
      'usePreviewMode',
    ]
    expect(Object.keys(composables).sort()).toEqual([...new Set([...testedComposables, ...skippedComposables])].sort())
  })
})

describe('errors', () => {
  it('createError', () => {
    expect(createError({ statusCode: 404 }).toJSON()).toMatchInlineSnapshot(`
      {
        "message": "",
        "statusCode": 404,
      }
    `)
    expect(createError('Message').toJSON()).toMatchInlineSnapshot(`
      {
        "message": "Message",
        "statusCode": 500,
      }
    `)
  })

  it('isNuxtError', () => {
    const error = createError({ statusCode: 404 })
    expect(isNuxtError(error)).toBe(true)
    expect(isNuxtError(new Error('test'))).toBe(false)
  })

  it('global nuxt errors', () => {
    const error = useError()
    expect(error.value).toBeUndefined()
    showError('new error')
    expect(error.value).toMatchInlineSnapshot('[Error: new error]')
    clearError()
    expect(error.value).toBe(undefined)
  })
})

describe('onNuxtReady', () => {
  it('should call callback once nuxt is hydrated', async () => {
    const fn = vi.fn()
    onNuxtReady(fn)
    await new Promise(resolve => setTimeout(resolve, 1))
    expect(fn).toHaveBeenCalled()
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
  it('default', () => {
    expect(useState(() => 'default').value).toBe('default')
  })

  it('registers state in payload', () => {
    useState('key', () => 'value')
    expect(Object.entries(useNuxtApp().payload.state)).toContainEqual(['$skey', 'value'])
  })
})

describe('clearNuxtState', () => {
  it('clears state in payload for single key', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    expect(state.value).toBe('test')
    clearNuxtState(key)
    expect(state.value).toBeUndefined()
  })

  it('clears state in payload for array of keys', () => {
    const key1 = 'clearNuxtState-test'
    const key2 = 'clearNuxtState-test2'
    const state1 = useState(key1, () => 'test')
    const state2 = useState(key2, () => 'test')
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    clearNuxtState([key1, 'other'])
    expect(state1.value).toBeUndefined()
    expect(state2.value).toBe('test')
    clearNuxtState([key1, key2])
    expect(state1.value).toBeUndefined()
    expect(state2.value).toBeUndefined()
  })

  it('clears state in payload for function', () => {
    const key = 'clearNuxtState-test'
    const state = useState(key, () => 'test')
    expect(state.value).toBe('test')
    clearNuxtState(() => false)
    expect(state.value).toBe('test')
    clearNuxtState(k => k === key)
    expect(state.value).toBeUndefined()
  })

  it('clears all state when no key is provided', () => {
    const state1 = useState('clearNuxtState-test', () => 'test')
    const state2 = useState('clearNuxtState-test2', () => 'test')
    expect(state1.value).toBe('test')
    expect(state2.value).toBe('test')
    clearNuxtState()
    expect(state1.value).toBeUndefined()
    expect(state2.value).toBeUndefined()
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
})

describe('loading state', () => {
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
})

describe('loading state', () => {
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
})

describe('loading state', () => {
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
})

describe.skipIf(process.env.TEST_MANIFEST === 'manifest-off')('app manifests', () => {
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
            "/pre/test": {
              "redirect": "/",
            },
            "/specific-prerendered": {
              "prerender": true,
            },
          },
          "wildcard": {
            "/pre": {
              "prerender": true,
            },
          },
        },
        "prerendered": [],
      }
    `)
  })
  it('getRouteRules', async () => {
    expect(await getRouteRules({ path: '/' })).toMatchInlineSnapshot('{}')
    expect(await getRouteRules({ path: '/pre' })).toMatchInlineSnapshot(`
      {
        "prerender": true,
      }
    `)
    expect(await getRouteRules({ path: '/pre/test' })).toMatchInlineSnapshot(`
      {
        "prerender": true,
        "redirect": "/",
      }
    `)
  })
  it('isPrerendered', async () => {
    expect(await isPrerendered('/specific-prerendered')).toBeTruthy()
    expect(await isPrerendered('/prerendered/test')).toBeFalsy()
    expect(await isPrerendered('/test')).toBeFalsy()
    expect(await isPrerendered('/pre/test')).toBeFalsy()
    expect(await isPrerendered('/pre/thing')).toBeTruthy()
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
  it('navigateTo should disallow navigation to external URLs by default', () => {
    expect(() => navigateTo('https://test.com')).toThrowErrorMatchingInlineSnapshot('[Error: Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.]')
    expect(() => navigateTo('https://test.com', { external: true })).not.toThrow()
  })
  it('navigateTo should disallow navigation to data/script URLs', () => {
    const urls = [
      ['data:alert("hi")', 'data'],
      ['\0data:alert("hi")', 'data'],
    ]
    for (const [url, protocol] of urls) {
      expect(() => navigateTo(url, { external: true })).toThrowError(`Cannot navigate to a URL with '${protocol}:' protocol.`)
    }
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
})

describe('routing utilities: `useRoute`', () => {
  it('should provide a route', () => {
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
})

describe('routing utilities: `abortNavigation`', () => {
  it('should throw an error if one is provided', () => {
    const error = useError()
    expect(() => abortNavigation({ message: 'Page not found' })).toThrowErrorMatchingInlineSnapshot('[Error: Page not found]')
    expect(error.value).toBe(undefined)
  })
  it('should block navigation if no error is provided', () => {
    expect(abortNavigation()).toMatchInlineSnapshot('false')
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
})

describe('defineNuxtComponent', () => {
  it('should produce a Vue component', async () => {
    const wrapper = await mountSuspended(defineNuxtComponent({
      render: () => h('div', 'hi there'),
    }))
    expect(wrapper.html()).toMatchInlineSnapshot('"<div>hi there</div>"')
  })

  it('should support Options API asyncData', async () => {
    const nuxtApp = useNuxtApp()
    nuxtApp.isHydrating = true
    nuxtApp.payload.serverRendered = true
    const ClientOnlyPage = await createClientPage(() => Promise.resolve(defineNuxtComponent({
      asyncData: () => ({
        users: ['alice', 'bob'],
      }),
      render () {
        // @ts-expect-error this is not typed
        return h('div', `Total users: ${this.users.value.length}`)
      },
    })))
    const wrapper = await mountSuspended(ClientOnlyPage)
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>Total users: 2</div>"`)
    nuxtApp.isHydrating = false
    nuxtApp.payload.serverRendered = false
  })

  it('should support Options API refreshNuxtData', async () => {
    let count = 0
    const component = defineNuxtComponent({
      asyncData: () => ({
        number: count++,
      }),
      setup () {
        const vm = getCurrentInstance()
        return () => {
          // @ts-expect-error go directly to jail 😈
          return h('div', vm!.render.number.value)
        }
      },
    })

    const wrapper = await mountSuspended(component)
    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>0</div>"`)

    await refreshNuxtData()

    expect(wrapper.html()).toMatchInlineSnapshot(`"<div>1</div>"`)
  })

  it.todo('should support Options API head')
})

describe('useCookie', () => {
  it('should watch custom cookie refs', () => {
    const user = useCookie('userInfo', {
      default: () => ({ score: -1 }),
      maxAge: 60 * 60,
    })
    const computedVal = computed(() => user.value.score)
    expect(computedVal.value).toBe(-1)
    user.value.score++
    expect(computedVal.value).toBe(0)
  })

  it('cookie decode function should be invoked once', () => {
    // Pre-set cookies
    document.cookie = 'foo=Foo'
    document.cookie = 'bar=%7B%22s2%22%3A0%7D'
    document.cookie = 'baz=%7B%22s2%22%3A0%7D'

    let barCallCount = 0
    const bazCookie = useCookie<{ s2: number }>('baz', {
      default: () => ({ s2: -1 }),
      decode (value) {
        barCallCount++
        return destr(decodeURIComponent(value))
      },
    })
    bazCookie.value.s2++
    expect(bazCookie.value.s2).toEqual(1)
    expect(barCallCount).toBe(1)

    let quxCallCount = 0
    const quxCookie = useCookie<{ s3: number }>('qux', {
      default: () => ({ s3: -1 }),
      filter: key => key === 'bar' || key === 'baz',
      decode (value) {
        quxCallCount++
        return destr(decodeURIComponent(value))
      },
    })
    quxCookie.value.s3++
    expect(quxCookie.value.s3).toBe(0)
    expect(quxCallCount).toBe(2)
  })

  it('should not watch custom cookie refs when shallow', () => {
    for (const value of ['shallow', false] as const) {
      const user = useCookie('shallowUserInfo', {
        default: () => ({ score: -1 }),
        maxAge: 60 * 60,
        watch: value,
      })
      const computedVal = computed(() => user.value.score)
      expect(computedVal.value).toBe(-1)
      user.value.score++
      expect(computedVal.value).toBe(-1)
    }
  })

  it('should set cookie value when called on client', () => {
    useCookie('cookie-watch-false', { default: () => 'foo', watch: false })
    expect(document.cookie).toContain('cookie-watch-false=foo')

    useCookie('cookie-watch-true', { default: () => 'foo', watch: true })
    expect(document.cookie).toContain('cookie-watch-true=foo')

    useCookie('cookie-readonly', { default: () => 'foo', readonly: true })
    expect(document.cookie).toContain('cookie-readonly=foo')
  })
})

describe('callOnce', () => {
  describe.each([
    ['without options', undefined],
    ['with "render" option', { mode: 'render' as const }],
    ['with "navigation" option', { mode: 'navigation' as const }],
  ])('%s', (_name, options) => {
    const nuxtApp = useNuxtApp()
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

      await nuxtApp.callHook('page:start')
      await execute()
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })
})

describe('route announcer', () => {
  it('should create a route announcer with default politeness', () => {
    const announcer = useRouteAnnouncer()
    expect(announcer.politeness.value).toBe('polite')
  })

  it('should create a route announcer with provided politeness', () => {
    const announcer = useRouteAnnouncer({ politeness: 'assertive' })
    expect(announcer.politeness.value).toBe('assertive')
  })

  it('should set message and politeness', () => {
    const announcer = useRouteAnnouncer()
    announcer.set('Test message with politeness', 'assertive')
    expect(announcer.message.value).toBe('Test message with politeness')
    expect(announcer.politeness.value).toBe('assertive')
  })

  it('should set message with polite politeness', () => {
    const announcer = useRouteAnnouncer()
    announcer.polite('Test message polite')
    expect(announcer.message.value).toBe('Test message polite')
    expect(announcer.politeness.value).toBe('polite')
  })

  it('should set message with assertive politeness', () => {
    const announcer = useRouteAnnouncer()
    announcer.assertive('Test message assertive')
    expect(announcer.message.value).toBe('Test message assertive')
    expect(announcer.politeness.value).toBe('assertive')
  })
})
