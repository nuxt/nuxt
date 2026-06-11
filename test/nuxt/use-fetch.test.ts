/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineEventHandler } from 'h3'

import { registerEndpoint } from '@nuxt/test-utils/runtime'

import { withQuery } from 'ufo'
import { flushPromises } from '@vue/test-utils'

import { createUseFetch as _createUseFetch, useFetch, useLazyFetch } from '#app/composables/fetch'
import type { EffectScope } from 'vue'

const createUseFetch = (_createUseFetch as unknown as { __nuxt_factory: typeof _createUseFetch }).__nuxt_factory

interface TestData {
  method: string
  headers: Record<string, string>
}

registerEndpoint('/api/test', defineEventHandler(event => ({
  method: event.req.method,
  headers: Object.fromEntries(event.req.headers.entries()),
})))

registerEndpoint('/api/sleep', defineEventHandler((event) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ method: event.req.method, headers: Object.fromEntries(event.req.headers.entries()) })
    }, 100)
  })
}))

beforeEach(() => {
  vi.unstubAllGlobals()
})

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

  it('should produce different keys for FormData with duplicate keys or different files', async () => {
    registerEndpoint('/api/formdata-keys', defineEventHandler(() => ({ ok: true })))

    const nuxtApp = useNuxtApp()
    const getAsyncDataKeys = () => Object.keys(nuxtApp._asyncData).length
    const baseCount = getAsyncDataKeys()

    // FormData with multiple entries under the same key
    const fd1 = new FormData()
    fd1.append('files', new File([new Uint8Array(10)], 'a.txt'))
    fd1.append('files', new File([new Uint8Array(20)], 'b.txt'))

    // FormData with a single entry
    const fd2 = new FormData()
    fd2.append('files', new File([new Uint8Array(10)], 'a.txt'))

    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/formdata-keys', { body: fd1, method: 'POST' }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/formdata-keys', { body: fd2, method: 'POST' }, '')
    // Different number of entries should produce different keys
    expect.soft(getAsyncDataKeys()).toBe(baseCount + 2)

    // Same filename but different file sizes
    const fd3 = new FormData()
    fd3.append('file', new File([new Uint8Array(100)], 'doc.pdf'))

    const fd4 = new FormData()
    fd4.append('file', new File([new Uint8Array(200)], 'doc.pdf'))

    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/formdata-keys', { body: fd3, method: 'POST' }, '')
    /* @ts-expect-error Overriding auto-key */
    await useFetch('/api/formdata-keys', { body: fd4, method: 'POST' }, '')
    // Different file sizes should produce different keys
    expect.soft(getAsyncDataKeys()).toBe(baseCount + 4)
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

  it('should use default value with lazy', () => {
    const { data, pending } = useLazyFetch<TestData>('/api/test', { default: () => ({ method: 'default', headers: {} }) })
    expect(pending.value).toBe(true)
    expect(data.value).toEqual({ method: 'default', headers: {} })
    expect(data.value).not.toBeNull()
    expect(data.value.method).toEqual('default')
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

  it('should cancel fetch request on clear', () => {
    let aborted = false

    class Mock {
      signal = { aborted: false }
      abort = () => {
        this.signal.aborted = true
        aborted = true
      }
    }
    vi.stubGlobal('AbortController',
      Mock,
    )
    const { clear } = useLazyFetch('/api/sleep')
    expect(aborted).toBe(false)
    clear()
    expect(aborted).toBe(true)
  })

  // https://github.com/nuxt/nuxt/issues/32102
  it('passes the current key to getCachedData with watch:false and a reactive key', async () => {
    registerEndpoint('/api/stale-key', defineEventHandler(() => ({ ok: true })))

    const query = ref('a')
    const seenKeys: string[] = []

    const { execute } = useFetch('/api/stale-key', {
      key: computed(() => `search-${query.value}`),
      getCachedData: (key) => {
        seenKeys.push(key)
        return undefined
      },
      watch: false,
    })

    await flushPromises()

    query.value = 'b'
    await nextTick()
    await execute()
    await flushPromises()

    // expected: the second invocation of getCachedData receives the current key
    expect(seenKeys.at(-1)).toBe('search-b')
  })

  // https://github.com/nuxt/nuxt/issues/32437
  // two useFetch calls with the same shape share an auto-key; with watch:false
  // the key is frozen at first init, so a second instance reads the first's data.
  it('does not leak data between instances sharing an auto-key with watch:false + execute()', async () => {
    registerEndpoint('/api/key/1', defineEventHandler(event => ({ url: '/api/key/1', q: event.req.url })))
    registerEndpoint('/api/key/2', defineEventHandler(event => ({ url: '/api/key/2', q: event.req.url })))

    const createScope = () => () => {
      const id = ref(1)
      const query = ref({ someInput: '' })
      const { data, execute } = useFetch(() => `/api/key/${toValue(id)}`, {
        query,
        watch: false,
        immediate: false,
      })
      return { data, execute, id, query }
    }

    const scope1 = effectScope()
    const { data: d1, id: i1, query: q1, execute: e1 } = scope1.run(createScope())!
    const scope2 = effectScope()
    const { data: d2 } = scope2.run(createScope())!

    expect.soft(d1.value).toStrictEqual(undefined)
    expect.soft(d2.value).toStrictEqual(undefined)

    q1.value.someInput = 'test'
    i1.value++
    await e1()
    await flushPromises()
    await nextTick()
    await flushPromises()

    // d1 should have data; d2 should remain untouched
    expect.soft(d1.value).toMatchObject({ url: '/api/key/2' })
    expect.soft(d2.value).toStrictEqual(undefined)
  })
})

describe('createUseFetch', () => {
  let scope: EffectScope
  beforeEach(() => {
    scope = effectScope()
  })
  afterEach(() => {
    scope.stop()
  })

  it('should use custom $fetch from factory (defaults mode)', async () => {
    const customFetch = vi.fn().mockResolvedValue({ variant: 'factory' })

    const { data } = await scope.run(() => {
      const useCustomFetch = createUseFetch({ $fetch: customFetch as unknown as typeof $fetch })
      return useCustomFetch('/api/test')
    })!

    expect(customFetch).toHaveBeenCalledOnce()
    expect(data.value).toEqual({ variant: 'factory' })
  })

  it('should allow per-call $fetch to override factory $fetch', async () => {
    const factoryFetch = vi.fn().mockResolvedValue({ variant: 'factory' })
    const callFetch = vi.fn().mockResolvedValue({ variant: 'call' })

    const { data } = await scope.run(() => {
      const useCustomFetch = createUseFetch({ $fetch: factoryFetch as unknown as typeof $fetch })
      return useCustomFetch('/api/test', { $fetch: callFetch as unknown as typeof $fetch })
    })!

    expect(factoryFetch).not.toHaveBeenCalled()
    expect(callFetch).toHaveBeenCalledOnce()
    expect(data.value).toEqual({ variant: 'call' })
  })

  it('should use baseURL from factory for URL validation', async () => {
    const customFetch = vi.fn().mockResolvedValue({ ok: true })

    await scope.run(async () => {
      const useCustomFetch = createUseFetch({ baseURL: 'https://example.com', $fetch: customFetch as unknown as typeof $fetch })
      // should not throw because factory provides baseURL
      await useCustomFetch('//api/test')
    })

    expect(customFetch).toHaveBeenCalledOnce()
  })

  it('should include factory options in cache key', async () => {
    const nuxtApp = useNuxtApp()
    const originalKeys = Object.keys(nuxtApp.payload.data)

    await scope.run(async () => {
      const customFetch = vi.fn().mockResolvedValue({ foo: 'bar' })
      const useCustomFetch = createUseFetch({ baseURL: 'https://example.com', $fetch: customFetch as unknown as typeof $fetch })
      // @ts-expect-error Overriding auto-key
      await useFetch('/api/test', {}, '')
      // @ts-expect-error Overriding auto-key
      await useCustomFetch('/api/test', {}, '')
    })

    const keysAfter = Object.keys(nuxtApp.payload.data)
    expect(keysAfter.length - originalKeys.length).toEqual(2)
  })
})
