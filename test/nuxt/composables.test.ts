/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'

import { mountSuspended, registerEndpoint } from 'nuxt-vitest/utils'

import * as composables from '#app/composables'

import { clearNuxtData, refreshNuxtData, useAsyncData, useNuxtData } from '#app/composables/asyncData'
import { clearError, createError, isNuxtError, showError, useError } from '#app/composables/error'
import { onNuxtReady } from '#app/composables/ready'
import { setResponseStatus, useRequestEvent, useRequestFetch, useRequestHeaders } from '#app/composables/ssr'
import { clearNuxtState, useState } from '#app/composables/state'
import { useRequestURL } from '#app/composables/url'
import { getAppManifest, getRouteRules } from '#app/composables/manifest'

vi.mock('#app/compat/idle-callback', () => ({
  requestIdleCallback: (cb: Function) => cb()
}))

const timestamp = Date.now()
registerEndpoint('/_nuxt/builds/latest.json', defineEventHandler(() => ({
  id: 'override',
  timestamp
})))
registerEndpoint('/_nuxt/builds/meta/override.json', defineEventHandler(() => ({
  id: 'override',
  timestamp,
  matcher: {
    static: {
      '/': null,
      '/pre': null,
      '/pre/test': { redirect: true }
    },
    wildcard: { '/pre': { prerender: true } },
    dynamic: {}
  },
  prerendered: ['/specific-prerendered']
})))
registerEndpoint('/api/test', defineEventHandler((event) => ({
  method: event.method,
  headers: Object.fromEntries(event.headers.entries())
})))

describe('app config', () => {
  it('can be updated', () => {
    const appConfig = useAppConfig()
    expect(appConfig).toMatchInlineSnapshot(`
      {
        "nuxt": {
          "buildId": "override",
        },
      }
    `)
    updateAppConfig({
      new: 'value',
      // @ts-expect-error property does not exist
      nuxt: { nested: 42 }
    })
    expect(appConfig).toMatchInlineSnapshot(`
      {
        "new": "value",
        "nuxt": {
          "buildId": "override",
          "nested": 42,
        },
      }
    `)
  })
})

describe('composables', () => {
  it('are all tested', () => {
    const testedComposables: string[] = [
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
      'onNuxtReady',
      'setResponseStatus',
      'prerenderRoutes',
      'useRequestEvent',
      'useRequestFetch',
      'isPrerendered',
      'useRequestHeaders',
      'clearNuxtState',
      'useState',
      'useRequestURL',
      'useRoute',
      'navigateTo',
      'abortNavigation',
      'setPageLayout',
      'defineNuxtComponent',
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
      'useCookie',
      'useFetch',
      'useHead',
      'useLazyFetch',
      'useLazyAsyncData',
      'useRouter',
      'useSeoMeta',
      'useServerSeoMeta'
    ]
    expect(Object.keys(composables).sort()).toEqual([...new Set([...testedComposables, ...skippedComposables])].sort())
  })
})

describe('useAsyncData', () => {
  it('should work at basic level', async () => {
    const res = useAsyncData(() => Promise.resolve('test'))
    expect(Object.keys(res)).toMatchInlineSnapshot(`
      [
        "data",
        "pending",
        "error",
        "status",
        "execute",
        "refresh",
      ]
    `)
    expect(res instanceof Promise).toBeTruthy()
    expect(res.data.value).toBe(null)
    await res
    expect(res.data.value).toBe('test')
  })

  it('should not execute with immediate: false', async () => {
    const immediate = await useAsyncData(() => Promise.resolve('test'))
    expect(immediate.data.value).toBe('test')
    expect(immediate.status.value).toBe('success')
    expect(immediate.pending.value).toBe(false)

    const nonimmediate = await useAsyncData(() => Promise.resolve('test'), { immediate: false })
    expect(nonimmediate.data.value).toBe(null)
    expect(nonimmediate.status.value).toBe('idle')
    expect(nonimmediate.pending.value).toBe(true)
  })

  it('should capture errors', async () => {
    const { data, error, status, pending } = await useAsyncData('error-test', () => Promise.reject(new Error('test')), { default: () => 'default' })
    expect(data.value).toMatchInlineSnapshot('"default"')
    expect(error.value).toMatchInlineSnapshot('[Error: test]')
    expect(status.value).toBe('error')
    expect(pending.value).toBe(false)
    expect(useNuxtApp().payload._errors['error-test']).toMatchInlineSnapshot('[Error: test]')

    // TODO: fix the below
    // const { data: syncedData, error: syncedError, status: syncedStatus, pending: syncedPending } = await useAsyncData('error-test', () => ({}), { immediate: false })

    // expect(syncedData.value).toEqual(null)
    // expect(syncedError.value).toEqual(error.value)
    // expect(syncedStatus.value).toEqual('idle')
    // expect(syncedPending.value).toEqual(true)
  })

  // https://github.com/nuxt/nuxt/issues/23411
  it('should initialize with error set to null when immediate: false', async () => {
    const { error, execute } = useAsyncData(() => ({}), { immediate: false })
    expect(error.value).toBe(null)
    await execute()
    expect(error.value).toBe(null)
  })

  it('should be accessible with useNuxtData', async () => {
    await useAsyncData('key', () => Promise.resolve('test'))
    const data = useNuxtData('key')
    expect(data.data.value).toMatchInlineSnapshot('"test"')
    clearNuxtData('key')
    expect(data.data.value).toBeUndefined()
    expect(useNuxtData('key').data.value).toBeUndefined()
  })

  it('should be usable _after_ a useNuxtData call', async () => {
    useNuxtApp().payload.data.call = null
    const { data: cachedData } = useNuxtData('call')
    expect(cachedData.value).toMatchInlineSnapshot('null')
    const { data } = await useAsyncData('call', () => Promise.resolve({ resolved: true }), { server: false })
    expect(cachedData.value).toMatchInlineSnapshot(`
      {
        "resolved": true,
      }
    `)
    expect(data.value).toEqual(cachedData.value)
    clearNuxtData('call')
  })

  it('should be refreshable', async () => {
    await useAsyncData('key', () => Promise.resolve('test'))
    clearNuxtData('key')
    const data = useNuxtData('key')
    expect(data.data.value).toBeUndefined()
    await refreshNuxtData('key')
    expect(data.data.value).toMatchInlineSnapshot('"test"')
  })

  it('allows custom access to a cache', async () => {
    const { data } = await useAsyncData(() => ({ val: true }), { getCachedData: () => ({ val: false }) })
    expect(data.value).toMatchInlineSnapshot(`
      {
        "val": false,
      }
    `)
  })

  it('should use default while pending', async () => {
    const promise = useAsyncData(() => Promise.resolve('test'), { default: () => 'default' })
    const { data, pending } = promise

    expect(pending.value).toBe(true)
    expect(data.value).toMatchInlineSnapshot('"default"')

    await promise
    expect(data.value).toMatchInlineSnapshot('"test"')
  })

  it('should use default after reject', async () => {
    const { data } = await useAsyncData(() => Promise.reject(new Error('test')), { default: () => 'default' })
    expect(data.value).toMatchInlineSnapshot('"default"')
  })
})

describe('useFetch', () => {
  it('should match with/without computed values', async () => {
    const nuxtApp = useNuxtApp()
    const getPayloadEntries = () => Object.keys(nuxtApp.payload.data).length
    const baseCount = getPayloadEntries()

    await useFetch('/api/test')
    expect(getPayloadEntries()).toBe(baseCount + 1)

    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { method: 'POST' }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { method: ref('POST') }, '')
    expect.soft(getPayloadEntries()).toBe(baseCount + 2)

    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers: { id: '3' } }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers: { id: ref('3') } }, '')
    const headers = new Headers()
    headers.append('id', '3')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers: [['id', '3']] }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers: [['id', ref('3')]] }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { headers: [[computed(() => 'id'), '3']] }, '')
    expect.soft(getPayloadEntries()).toBe(baseCount + 3)
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
    const err = useError()
    expect(err.value).toBeUndefined()
    showError('new error')
    expect(err.value).toMatchInlineSnapshot('[Error: new error]')
    clearError()
    // TODO: should this return to being undefined?
    expect(err.value).toBeNull()
  })
})

describe('onNuxtReady', () => {
  it('should call callback immediately once nuxt is hydrated', () => {
    const fn = vi.fn()
    onNuxtReady(fn)
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

describe.skipIf(process.env.TEST_MANIFEST === 'manifest-off')('app manifests', () => {
  it('getAppManifest', async () => {
    const manifest = await getAppManifest()
    delete manifest.timestamp
    expect(manifest).toMatchInlineSnapshot(`
      {
        "id": "override",
        "matcher": {
          "dynamic": {},
          "static": {
            "/": null,
            "/pre": null,
            "/pre/test": {
              "redirect": true,
            },
          },
          "wildcard": {
            "/pre": {
              "prerender": true,
            },
          },
        },
        "prerendered": [
          "/specific-prerendered",
        ],
      }
    `)
  })
  it('getRouteRules', async () => {
    expect(await getRouteRules('/')).toMatchInlineSnapshot('{}')
    expect(await getRouteRules('/pre')).toMatchInlineSnapshot(`
      {
        "prerender": true,
      }
    `)
    expect(await getRouteRules('/pre/test')).toMatchInlineSnapshot(`
      {
        "prerender": true,
        "redirect": true,
      }
    `)
  })
  it('isPrerendered', async () => {
    expect(await isPrerendered('/specific-prerendered')).toBeTruthy()
    expect(await isPrerendered('/prerendered/test')).toBeTruthy()
    expect(await isPrerendered('/test')).toBeFalsy()
    expect(await isPrerendered('/pre/test')).toBeFalsy()
    expect(await isPrerendered('/pre/thing')).toBeTruthy()
  })
})

describe('routing utilities: `navigateTo`', () => {
  it('navigateTo should disallow navigation to external URLs by default', () => {
    expect(() => navigateTo('https://test.com')).toThrowErrorMatchingInlineSnapshot('"Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`."')
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
})

describe('routing utilities: `useRoute`', () => {
  it('should show provide a mock route', async () => {
    expect(useRoute()).toMatchObject({
      fullPath: '/',
      hash: '',
      href: '/',
      matched: [],
      meta: {},
      name: undefined,
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
    expect(() => abortNavigation({ message: 'Page not found' })).toThrowErrorMatchingInlineSnapshot('"Page not found"')
    expect(error.value).toBeFalsy()
  })
  it('should block navigation if no error is provided', () => {
    expect(abortNavigation()).toMatchInlineSnapshot('false')
  })
})

describe('routing utilities: `setPageLayout`', () => {
  it('should set error on page metadata if run outside middleware', () => {
    const route = useRoute()
    expect(route.meta.layout).toBeUndefined()
    setPageLayout('custom')
    expect(route.meta.layout).toEqual('custom')
    route.meta.layout = undefined
  })

  it('should not set layout directly if run within middleware', async () => {
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
      render: () => h('div', 'hi there')
    }))
    expect(wrapper.html()).toMatchInlineSnapshot('"<div>hi there</div>"')
  })
  it.todo('should support Options API asyncData')
  it.todo('should support Options API head')
})
