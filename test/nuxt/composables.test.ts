/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { describe, expect, it, vi } from 'vitest'

import * as composables from '#app/composables'

import { clearNuxtData, refreshNuxtData, useAsyncData, useNuxtData } from '#app/composables/asyncData'
import { clearError, createError, isNuxtError, showError, useError } from '#app/composables/error'
import { onNuxtReady } from '#app/composables/ready'
import { setResponseStatus, useRequestEvent, useRequestFetch, useRequestHeaders } from '#app/composables/ssr'
import { clearNuxtState, useState } from '#app/composables/state'
import { useRequestURL } from '#app/composables/url'

vi.mock('#app/compat/idle-callback', () => ({
  requestIdleCallback: (cb: Function) => cb()
}))

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
      'onNuxtReady',
      'setResponseStatus',
      'useRequestEvent',
      'useRequestFetch',
      'useRequestHeaders',
      'clearNuxtState',
      'useState',
      'useRequestURL'
    ]
    const skippedComposables: string[] = [
      'abortNavigation',
      'addRouteMiddleware',
      'defineNuxtComponent',
      'defineNuxtRouteMiddleware',
      'definePayloadReducer',
      'definePayloadReviver',
      'isPrerendered',
      'loadPayload',
      'navigateTo',
      'onBeforeRouteLeave',
      'onBeforeRouteUpdate',
      'prefetchComponents',
      'preloadComponents',
      'preloadPayload',
      'preloadRouteComponents',
      'reloadNuxtApp',
      'setPageLayout',
      'useCookie',
      'useFetch',
      'useHead',
      'useHydration',
      'useLazyFetch',
      'useLazyAsyncData',
      'useRoute',
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
    const { error, status, pending } = await useAsyncData(() => Promise.reject(new Error('test')))
    expect(error.value).toMatchInlineSnapshot('[Error: test]')
    expect(status.value).toBe('error')
    expect(pending.value).toBe(false)
  })

  it('should be accessible with useNuxtData', async () => {
    await useAsyncData('key', () => Promise.resolve('test'))
    const data = useNuxtData('key')
    expect(data.data.value).toMatchInlineSnapshot('"test"')
    clearNuxtData('key')
    expect(data.data.value).toBeUndefined()
    expect(useNuxtData('key').data.value).toBeUndefined()
  })

  it('should be refreshable', async () => {
    await useAsyncData('key', () => Promise.resolve('test'))
    clearNuxtData('key')
    const data = useNuxtData('key')
    expect(data.data.value).toBeUndefined()
    await refreshNuxtData('key')
    expect(data.data.value).toMatchInlineSnapshot('"test"')
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

  it.todo('clearNuxtState', () => {
    const state = useState(() => 'test')
    expect(state.value).toBe('test')
    clearNuxtState()
    expect.soft(state.value).toBeUndefined()
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
