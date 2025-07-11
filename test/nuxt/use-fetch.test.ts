/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'

import { registerEndpoint } from '@nuxt/test-utils/runtime'

import { withQuery } from 'ufo'
import { flushPromises } from '@vue/test-utils'

import { useFetch, useLazyFetch } from '#app/composables/fetch'

interface TestData {
  method: string
  headers: Record<string, string>
}

registerEndpoint('/api/test', defineEventHandler(event => ({
  method: event.method,
  headers: Object.fromEntries(event.headers.entries()),
})))

describe('useFetch', () => {
  beforeEach(() => {
    clearNuxtData()
  })
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

  it('should not trigger rerunning fetch if `watch: false`', async () => {
    let count = 0
    registerEndpoint('/api/rerun', defineEventHandler(() => ({ count: count++ })))

    const q = ref('')
    const { data } = await useFetch('/api/rerun', {
      query: { q },
      watch: false,
    })

    expect(data.value).toStrictEqual({ count: 0 })
    q.value = 'test'

    await flushPromises()
    await nextTick()
    await flushPromises()

    expect(data.value).toStrictEqual({ count: 0 })
  })

  it.runIf(process.env.PROJECT === 'nuxt-legacy')('should work with reactive keys and immediate: false', async () => {
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

  it.runIf(process.env.PROJECT === 'nuxt-legacy')('should work with reactive request path and immediate: false', async () => {
    registerEndpoint('/api/immediate-false', defineEventHandler(() => ({ url: '/api/immediate-false' })))

    const q = ref('')
    const { data } = await useFetch(() => withQuery('/api/immediate-false', { q: q.value }), {
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
    const formData = new FormData()
    formData.append('file', new File([], 'test.txt'))
    const testCases = [
      { ref: ref('test') },
      ref('test'),
      formData,
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
    vi.useFakeTimers()

    const fetchPromise = useFetch(
      // @ts-expect-error should resolve to a string
      () => new Promise(resolve => setTimeout(resolve, 5000)),
      { timeout: 1 },
    )

    vi.advanceTimersByTime(2000)

    const { status, error } = await fetchPromise

    expect(status.value).toBe('error')
    expect(error.value?.toString()).toContain(`<no response>`)

    vi.useRealTimers()
  })

  it.runIf(process.env.PROJECT === 'nuxt-legacy')('should fetch if immediate is false and only the key changes with `experimental.alwaysRunFetchOnKeyChange`', async () => {
    const key = shallowRef('a')
    const { status } = useFetch('/api/test', { key, immediate: false })

    expect.soft(status.value).toBe('idle')

    key.value += 'a'
    await nextTick()
    expect.soft(status.value).toBe('pending')
  })

  it('should handle parallel execute with `immediate: false`', async () => {
    const query = reactive({ q: 1 })
    const { execute, status } = useFetch(
      '/api/test',
      {
        query,
        immediate: false,
      },
    )
    watch(query, () => execute(), { once: true })

    expect.soft(status.value).toBe('idle')
    query.q++
    query.q++

    await nextTick()
    query.q++

    expect.soft(status.value).toBe('pending')
    await vi.waitFor(() => {
      expect(status.value).toBe('success')
    })
    query.q++
    expect.soft(status.value).toBe('pending')
  })

  it('should pick values from data', async () => {
    const { data } = await useFetch<TestData>('/api/test', { pick: ['method'] })
    expect(data.value).toEqual({ method: 'GET' })
  })

  it('should transform data', async () => {
    const { data } = await useFetch('/api/test', { transform: (data: TestData) => ({ custom: data.method }) })
    expect(data.value).toEqual({ custom: 'GET' })
  })

  it('should use default value with lazy', async () => {
    const { data, pending } = useLazyFetch<TestData>('/api/test', { default: () => ({ method: 'default', headers: {} }) })
    expect(pending.value).toBe(true)
    expect(data.value).toEqual({ method: 'default', headers: {} })
    await nextTick()
    await flushPromises()
    expect(data.value).not.toBeNull()
    if (data.value) {
      expect(data.value.method).toEqual('default')
    }
  })

  it('should not execute with immediate: false and be executable', async () => {
    const { data, status, execute } = useFetch<TestData>('/api/test', { immediate: false })
    expect(data.value).toBe(undefined)
    expect(status.value).toBe('idle')
    await execute()
    expect(data.value).not.toBeNull()
    if (data.value) {
      expect(data.value.method).toEqual('GET')
    }
    expect(status.value).toBe('success')
  })
})
