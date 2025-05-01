/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'
import { destr } from 'destr'

import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'

import { hasProtocol } from 'ufo'
import { flushPromises } from '@vue/test-utils'
import { createClientPage } from '../../packages/nuxt/src/components/runtime/client-component'
import * as composables from '#app/composables'

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

// @ts-expect-error virtual file
import { asyncDataDefaults } from '#build/nuxt.config.mjs'

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

describe('useAsyncData', () => {
  let uniqueKey: string
  let counter = 0

  beforeEach(() => {
    uniqueKey = `key-${++counter}`
  })

  function mountWithAsyncData (...args: any[]) {
    return new Promise<ReturnType<typeof useAsyncData> & ReturnType<typeof mountSuspended<unknown>>>((resolve) => {
      let res: ReturnType<typeof useAsyncData & ReturnType<typeof mountSuspended>>
      const component = defineComponent({
        setup () {
          res = useAsyncData(...args as [any])
          return () => h('div', [res.data.value as any])
        },
      })

      mountSuspended(component).then(c => resolve(Object.assign(c, res)))
    })
  }

  it('should work at basic level', async () => {
    const res = useAsyncData(() => Promise.resolve('test'))
    expect(Object.keys(res).sort()).toMatchInlineSnapshot(`
      [
        "clear",
        "data",
        "error",
        "execute",
        "pending",
        "refresh",
        "status",
      ]
    `)
    expect(res instanceof Promise).toBeTruthy()
    expect(res.data.value).toBe(undefined)
    await res
    expect(res.data.value).toBe('test')
  })

  it('should not execute with immediate: false', async () => {
    const immediate = await useAsyncData(() => Promise.resolve('test'))
    expect(immediate.data.value).toBe('test')
    expect(immediate.status.value).toBe('success')
    expect(immediate.pending.value).toBe(false)

    const nonimmediate = await useAsyncData(() => Promise.resolve('test'), { immediate: false })
    expect(nonimmediate.data.value).toBe(undefined)
    expect(nonimmediate.status.value).toBe('idle')
    expect(nonimmediate.pending.value).toBe(false)
  })

  it('should capture errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { data, error, status, pending } = await useAsyncData(uniqueKey, () => Promise.reject(new Error('test')), { default: () => 'default' })
    expect(data.value).toMatchInlineSnapshot('"default"')
    expect(error.value).toMatchInlineSnapshot('[Error: test]')
    expect(status.value).toBe('error')
    expect(pending.value).toBe(false)
    expect(useNuxtApp().payload._errors[uniqueKey]).toMatchInlineSnapshot('[Error: test]')

    const { data: syncedData, error: syncedError, status: syncedStatus, pending: syncedPending } = await useAsyncData(uniqueKey, () => ({} as any), { immediate: false })

    expect(syncedData.value).toBe(data.value)
    expect(syncedError.value).toBe(error.value)
    expect(syncedStatus.value).toBe(status.value)
    expect(syncedPending.value).toBe(false)

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[nuxt\] \[useAsyncData\] Incompatible options detected for "[^"]+" \(used at .*:\d+:\d+\):\n- different handler\n- different `default` value\nYou can use a different key or move the call to a composable to ensure the options are shared across calls./,
    ))
    warn.mockClear()
  })

  // https://github.com/nuxt/nuxt/issues/23411
  it('should initialize with error set to null when immediate: false', async () => {
    const { error, execute } = useAsyncData(() => Promise.resolve({}), { immediate: false })
    expect(error.value).toBe(undefined)
    await execute()
    expect(error.value).toBe(undefined)
  })

  it('should be accessible with useNuxtData', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'))
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"test"')
    clearNuxtData(uniqueKey)
    expect(data.data.value).toBeUndefined()
    expect(useNuxtData(uniqueKey).data.value).toBeUndefined()
  })

  it('should be usable _after_ a useNuxtData call', async () => {
    useNuxtApp().payload.data[uniqueKey] = null
    const { data: cachedData } = useNuxtData(uniqueKey)
    expect(cachedData.value).toMatchInlineSnapshot('null')
    const { data } = await useAsyncData(uniqueKey, () => Promise.resolve({ resolved: true }), { server: false })
    expect(cachedData.value).toMatchInlineSnapshot(`
      {
        "resolved": true,
      }
    `)
    expect(data.value).toEqual(cachedData.value)
    clearNuxtData(uniqueKey)
  })

  it('should be usable _after_ a useNuxtData call after navigation', async () => {
    const getData = async () => {
      const wrapper = await mountSuspended(({
        async setup () {
          useNuxtData(uniqueKey)
          const { data } = await useAsyncData(uniqueKey, () => Promise.resolve('foo'))
          return () => h('div', [data.value])
        },
      }))
      try {
        return wrapper.html({ raw: true })
      } finally {
        wrapper.unmount()
      }
    }
    useNuxtApp().payload.data[uniqueKey] = null
    expect(await getData()).toMatchInlineSnapshot(`"<div>foo</div>"`)
    // simulate a second visit to the page
    expect(await getData()).toMatchInlineSnapshot(`"<div>foo</div>"`)
  })

  it('should be refreshable', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'))
    clearNuxtData(uniqueKey)
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toBeUndefined()
    await refreshNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"test"')
  })

  it('should allow overriding requests', async () => {
    let count = 0
    let timeout = 0
    // pretending we're hydrating a server rendered app
    const nuxtApp = useNuxtApp()
    nuxtApp.payload.data[uniqueKey] = 1

    const fetcher = vi.fn(() => new Promise(resolve => setTimeout(() => resolve(++count), timeout)))
    const { data, refresh } = await useAsyncData(uniqueKey, fetcher, {
      getCachedData (key, nuxtApp, context) {
        // force bypass cache after first load (equivalent to previous `_initial: false`)
        if (context.cause === 'initial') {
          return nuxtApp.payload.data[key]
        }
      },
    })

    expect(fetcher).not.toHaveBeenCalled()
    expect.soft(count).toBe(0)
    expect.soft(data.value).toBe(1)

    timeout = 100
    const p = refresh({ dedupe: 'cancel' })

    expect(fetcher).toHaveBeenCalled()

    expect.soft(count).toBe(0)
    expect.soft(data.value).toBe(1)

    timeout = 0
    await refresh()

    expect.soft(count).toBe(1)
    expect.soft(data.value).toBe(1)

    await p

    expect.soft(count).toBe(2)
    expect.soft(data.value).toBe(1)
  })

  it('should be clearable', async () => {
    const { data, error, pending, status, clear } = await useAsyncData(() => Promise.resolve('test'))
    expect(data.value).toBe('test')

    clear()

    expect(data.value).toBeUndefined()
    expect(error.value).toBe(undefined)
    expect(pending.value).toBe(false)
    expect(status.value).toBe('idle')
  })

  it('should have correct status for previously fetched requests', async () => {
    const route = useRoute()

    const res = await mountWithAsyncData(route.fullPath,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return 'test'
      }, { lazy: true },
    )

    expect(res.data.value).toBe(undefined)
    expect(res.status.value).toBe('pending')
    expect(res.pending.value).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 1))

    expect(res.data.value).toBe('test')
    expect(res.status.value).toBe('success')
    expect(res.pending.value).toBe(false)

    res.unmount()

    await flushPromises()

    expect(res.data.value).toBe(asyncDataDefaults.value)
    expect(res.status.value).toBe('idle')
    expect(res.pending.value).toBe(false)

    const res2 = await mountWithAsyncData(route.fullPath,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        return 'test'
      }, { lazy: true },
    )

    expect(res2.data.value).toBe(asyncDataDefaults.value)
    expect(res2.status.value).toBe('pending')
    expect(res2.pending.value).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 1))

    expect(res2.data.value).toBe('test')
    expect(res2.status.value).toBe('success')
    expect(res2.pending.value).toBe(false)
  })

  it('should be refreshable with force and cache', async () => {
    await useAsyncData(uniqueKey, () => Promise.resolve('test'), {
      getCachedData: (key, nuxtApp, ctx) => {
        console.log(key, ctx.cause)
        return ctx.cause
      },
    })
    await refreshNuxtData(uniqueKey)
    await nextTick()
    const data = useNuxtData(uniqueKey)
    expect(data.data.value).toMatchInlineSnapshot('"refresh:hook"')
  })

  it('allows custom access to a cache', async () => {
    const { data } = await useAsyncData(() => Promise.resolve({ val: true }), { getCachedData: () => ({ val: false }) })
    expect(data.value).toMatchInlineSnapshot(`
      {
        "val": false,
      }
    `)
  })

  it('should only call getCachedData once', async () => {
    const getCachedData = vi.fn(() => ({ val: false }))
    const { data } = await useAsyncData(() => Promise.resolve({ val: true }), { getCachedData })
    expect(data.value).toMatchInlineSnapshot(`
      {
        "val": false,
      }
    `)
    expect(getCachedData).toHaveBeenCalledTimes(1)
  })

  it('will use cache on refresh by default', async () => {
    const { data, refresh } = await useAsyncData(() => Promise.resolve('other value'), { getCachedData: () => 'cached' })
    expect(data.value).toBe('cached')
    await refresh()
    expect(data.value).toBe('cached')
  })

  it('getCachedData should receive triggeredBy on initial fetch', async () => {
    const { data } = await useAsyncData(() => Promise.resolve(''), { getCachedData: (key, nuxtApp, ctx) => ctx.cause })
    expect(data.value).toBe('initial')
  })

  it('getCachedData should receive triggeredBy on manual refresh', async () => {
    const { data, refresh } = await useAsyncData(() => Promise.resolve(''), {
      getCachedData: (key, nuxtApp, ctx) => ctx.cause,
    })
    await refresh()
    expect(data.value).toBe('refresh:manual')
  })

  it('getCachedData should receive triggeredBy on watch', async () => {
    const number = ref(0)
    const { data } = await useAsyncData(() => Promise.resolve(''), {
      getCachedData: (key, nuxtApp, ctx) => ctx.cause,
      watch: [number],
    })
    number.value = 1
    await flushPromises()
    expect(data.value).toBe('watch')
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

  it('should execute the promise function once when dedupe option is "defer" for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData('dedupedKey', promiseFn, { dedupe: 'defer' })
    useAsyncData('dedupedKey', promiseFn, { dedupe: 'defer' })
    useAsyncData('dedupedKey', promiseFn, { dedupe: 'defer' })

    expect(promiseFn).toHaveBeenCalledTimes(1)
  })

  it('should execute the promise function multiple times when dedupe option is not specified for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData('dedupedKey1', promiseFn)
    useAsyncData('dedupedKey1', promiseFn)
    useAsyncData('dedupedKey1', promiseFn)

    expect(promiseFn).toHaveBeenCalledTimes(3)
  })

  it('should execute the promise function as per dedupe option when different dedupe options are used for multiple calls', () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    useAsyncData('dedupedKey2', promiseFn, { dedupe: 'defer' })
    useAsyncData('dedupedKey2', promiseFn)
    useAsyncData('dedupedKey2', promiseFn, { dedupe: 'defer' })

    expect(promiseFn).toHaveBeenCalledTimes(2)
  })

  it('should warn if incompatible options are used', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: false })
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData('dedupedKey3', () => Promise.resolve('test'), { deep: true })
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      /\[nuxt\] \[useAsyncData\] Incompatible options detected for "dedupedKey3" \(used at .*:\d+:\d+\):\n- mismatching `deep` option\nYou can use a different key or move the call to a composable to ensure the options are shared across calls./,
    ))

    let count = 0
    for (const opt of ['transform', 'pick', 'getCachedData'] as const) {
      warn.mockClear()
      count++

      await mountWithAsyncData(`dedupedKey3-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      await mountWithAsyncData(`dedupedKey3-${count}`, () => Promise.resolve('test'), { [opt]: () => ({}) })
      expect(warn).not.toHaveBeenCalled()
      await mountWithAsyncData(`dedupedKey3-${count}`, () => Promise.resolve('test'))
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(
          new RegExp(`\\[nuxt\\] \\[useAsyncData\\] Incompatible options detected for "dedupedKey3-${count}" \\(used at .*:\\d+:\\d+\\):\n- different \`${opt}\` option\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`),
        ))
    }

    warn.mockClear()
    count++

    await mountWithAsyncData(`dedupedKey3-${count}`, () => Promise.resolve('test'))
    expect(warn).not.toHaveBeenCalled()
    await mountWithAsyncData(`dedupedKey3-${count}`, () => Promise.resolve('bob'))
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(
      new RegExp(`\\[nuxt\\] \\[useAsyncData\\] Incompatible options detected for "dedupedKey3-${count}" \\(used at .*:\\d+:\\d+\\):\n- different handler\nYou can use a different key or move the call to a composable to ensure the options are shared across calls.`),
    ))

    warn.mockReset()
  })

  it('should only refresh asyncdata once when watched dependency is updated', async () => {
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const route = ref('/')
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(uniqueKey, promiseFn, { watch: [route] })
        return () => h('div', [data.value])
      },
    })

    await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(2)

    route.value = '/about'
    await nextTick()
    expect(promiseFn).toHaveBeenCalledTimes(3)
  })

  const key = ref()
  const cases = [
    { name: 'ref', getter: key },
    { name: 'getter', getter: () => key.value },
  ]

  it.each(cases)('should work with keys computed from $name', async ({ name, getter }) => {
    const firstKey = `${name}-firstKey`
    const secondKey = `${name}-secondKey`
    key.value = firstKey

    const promiseFn = vi.fn(() => Promise.resolve(key.value))
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(getter, promiseFn)
        return () => h('div', [data.value])
      },
    })

    const comp = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    key.value = secondKey
    await flushPromises()
    expect(promiseFn).toHaveBeenCalledTimes(2)

    expect(useNuxtData(firstKey).data.value).toBeUndefined()
    expect(useNuxtData(secondKey).data.value).toBe(secondKey)

    expect(useNuxtApp()._asyncData[firstKey]!.data.value).toBe(asyncDataDefaults.value)
    expect(useNuxtApp()._asyncData[secondKey]!.data.value).toBe(secondKey)

    comp.unmount()
  })

  it('should clear memory when last component using asyncData is unmounted', async () => {
    const key = 'several'
    const promiseFn = vi.fn(() => Promise.resolve('test'))
    const component = defineComponent({
      setup () {
        const { data } = useAsyncData(key, promiseFn)
        return () => h('div', [data.value])
      },
    })
    const getData = async () => {
      const component = await mountSuspended(defineComponent({
        setup () {
          const { data } = useNuxtData(key)
          return () => data.value === undefined ? 'undefined' : data.value
        },
      }))
      try {
        return component.html({ raw: true })
      } finally {
        component.unmount()
      }
    }

    const comp1 = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(1)

    const comp2 = await mountSuspended(component)
    expect(promiseFn).toHaveBeenCalledTimes(2)

    comp1.unmount()
    await nextTick()
    expect(await getData()).toMatchInlineSnapshot('"test"')

    comp2.unmount()
    await nextTick()
    expect(await getData()).toBe('undefined')
  })

  it('should remain reactive after being reinitialised', async () => {
    const promiseFn = vi.fn((value: string) => Promise.resolve(value))
    const component = (value: string) => defineComponent({
      setup () {
        const { data } = useAsyncData('fixed', () => promiseFn(value))
        return () => h('div', [data.value])
      },
    })

    const comp1 = await mountSuspended(component('first'))
    expect(promiseFn).toHaveBeenCalledTimes(1)
    comp1.unmount()

    const comp2 = await mountSuspended(component('second'))
    expect(promiseFn).toHaveBeenCalledTimes(2)
    expect(promiseFn).toHaveBeenLastCalledWith('second')
    expect(comp2.html()).toMatchInlineSnapshot(`"<div>second</div>"`)
  })

  it('should be synced with useNuxtData', async () => {
    const { data: nuxtData } = useNuxtData('nuxtdata-sync')
    const promise = useAsyncData('nuxtdata-sync', () => Promise.resolve('test'), { default: () => 'default' })
    const { data: fetchData } = promise

    expect(fetchData.value).toMatchInlineSnapshot('"default"')

    nuxtData.value = 'before-fetch'
    expect(fetchData.value).toMatchInlineSnapshot('"before-fetch"')

    await promise
    expect(fetchData.value).toMatchInlineSnapshot('"test"')
    expect(nuxtData.value).toMatchInlineSnapshot('"test"')

    nuxtData.value = 'new value'
    expect(fetchData.value).toMatchInlineSnapshot('"new value"')
    fetchData.value = 'another value'
    expect(nuxtData.value).toMatchInlineSnapshot('"another value"')
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
    await useFetch('/api/test', { query: { id: '3' } }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { query: { id: ref('3') } }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { params: { id: '3' } }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/test', { params: { id: ref('3') } }, '')
    expect.soft(getPayloadEntries()).toBe(baseCount + 3)
  })

  it('should work with reactive keys', async () => {
    registerEndpoint('/api/initial', defineEventHandler(() => ({ url: '/api/initial' })))
    registerEndpoint('/api/updated', defineEventHandler(() => ({ url: '/api/updated' })))

    const key = ref('/api/initial')

    const { data, error } = await useFetch(key)
    expect(data.value).toEqual({ url: '/api/initial' })

    key.value = '/api/updated'

    await flushPromises()
    await nextTick()
    await flushPromises()

    expect(data.value).toEqual({ url: '/api/updated' })
    expect(error.value).toBe(undefined)
  })

  it('should work with reactive keys and immediate: false', async () => {
    registerEndpoint('/api/immediate-false', defineEventHandler(() => ({ url: '/api/immediate-false' })))

    const q = ref('')
    const { data } = await useFetch('/api/immediate-false', {
      query: { q },
      immediate: false,
    })

    expect(data.value).toBe(undefined)
    q.value = 'test'

    await flushPromises()
    await nextTick()
    await flushPromises()

    expect(data.value).toEqual({ url: '/api/immediate-false' })
  })

  it('should be accessible immediately', async () => {
    registerEndpoint('/api/watchable-fetch', defineEventHandler(() => ({ url: '/api/watchable-fetch' })))

    const searchTerm = ref('')

    const { data } = await useFetch('/api/watchable-fetch', {
      params: { q: searchTerm },
    })

    for (const value of [undefined, 'pre', 'post', 'sync'] as const) {
      watchEffect(() => {
        expect(() => data.value).not.toThrow()
      }, { flush: value })
    }

    searchTerm.value = 'new'

    await nextTick()
    await flushPromises()
  })

  it('should handle complex objects in body', async () => {
    registerEndpoint('/api/complex-objects', defineEventHandler(() => ({ url: '/api/complex-objects' })))
    const testCases = [
      { ref: ref('test') },
      ref('test'),
      new FormData(),
      new ArrayBuffer(),
    ]
    for (const value of testCases) {
      // @ts-expect-error auto-key is not valid in type signature
      const { data: original } = await useFetch('/api/complex-objects', { body: value }, 'autokey')
      original.value = 'new value'
      // @ts-expect-error auto-key is not valid in type signature
      const { data } = await useFetch('/api/complex-objects', { body: value, immediate: false }, 'autokey')
      expect(data.value).toEqual('new value')
    }
  })

  it('should timeout', async () => {
    const { status, error } = await useFetch(
      // @ts-expect-error should resolve to a string
      () => new Promise(resolve => setTimeout(resolve, 5000)),
      { timeout: 1 },
    )
    await new Promise(resolve => setTimeout(resolve, 2))
    expect(status.value).toBe('error')
    expect(error.value).toMatchInlineSnapshot(`[Error: [GET] "[object Promise]": <no response> Failed to parse URL from [object Promise]]`)
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
    vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => cb()))
    const nuxtApp = useNuxtApp()
    const { isLoading } = useLoadingIndicator()
    expect(isLoading.value).toBeFalsy()
    await nuxtApp.callHook('page:loading:start')
    expect(isLoading.value).toBeTruthy()

    await nuxtApp.callHook('page:loading:end')
    expect(isLoading.value).toBeFalsy()
    vi.mocked(setTimeout).mockRestore()
  })
})

describe('loading state', () => {
  it('expect loading state to be changed by force starting/stoping', async () => {
    vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => cb()))
    const nuxtApp = useNuxtApp()
    const { isLoading, start, finish } = useLoadingIndicator()
    expect(isLoading.value).toBeFalsy()
    await nuxtApp.callHook('page:loading:start')
    expect(isLoading.value).toBeTruthy()
    start()
    expect(isLoading.value).toBeTruthy()
    finish()
    expect(isLoading.value).toBeFalsy()
  })
})

describe('loading state', () => {
  it('expect error from loading state to be changed by finish({ error: true })', async () => {
    vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => cb()))
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
  })
})

describe('loading state', () => {
  it('expect state from set opts: { force: true }', async () => {
    vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => cb()))
    const nuxtApp = useNuxtApp()
    const { isLoading, start, finish, set } = useLoadingIndicator()
    await nuxtApp.callHook('page:loading:start')
    start({ force: true })
    expect(isLoading.value).toBeTruthy()
    finish()
    expect(isLoading.value).toBeFalsy()
    set(0, { force: true })
    expect(isLoading.value).toBeTruthy()
    set(100, { force: true })
    expect(isLoading.value).toBeFalsy()
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
