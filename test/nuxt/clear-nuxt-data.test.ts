/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearNuxtData, useAsyncData } from '#app/composables/asyncData'

beforeEach(() => {
  vi.unstubAllGlobals()
})

// The existing `serialize: false` tests only assert that the key stays out of
// `payload.data`, and every existing `clearNuxtData` call site passes an explicit key,
// so none of them ever exercise the `_allKeys` derivation. Nobody had put those two
// facts together with a no-argument (or predicate) `clearNuxtData()` call, so these
// tests do that.
describe('clearNuxtData', () => {
  let uniqueKey: string
  let counter = 0

  beforeEach(() => {
    uniqueKey = `clear-nuxt-data-key-${++counter}`
  })

  it('resets data and status for a `serialize: false` entry with a no-arg clear', async () => {
    const nuxtApp = useNuxtApp()
    const { data, status } = await useAsyncData(uniqueKey, () => Promise.resolve('secret'), { serialize: false })

    expect(uniqueKey in nuxtApp.payload.data).toBe(false)
    expect(data.value).toBe('secret')

    clearNuxtData()

    expect(data.value).toBeUndefined()
    expect(status.value).toBe('idle')
  })

  it('clears the error and resets status for a rejected handler with a no-arg clear', async () => {
    const { error, status } = await useAsyncData(uniqueKey, () => Promise.reject(new Error('boom')))

    expect(error.value).toBeTruthy()
    expect(status.value).toBe('error')

    clearNuxtData()

    expect(error.value).toBeUndefined()
    expect(status.value).toBe('idle')
  })

  it('restores the default for a never-run (`immediate: false`) entry with a no-arg clear', () => {
    const { data } = useAsyncData(uniqueKey, () => Promise.resolve('later'), { immediate: false, default: () => 'DFLT' })

    expect(data.value).toBe('DFLT')
    data.value = 'mutated'

    clearNuxtData()

    expect(data.value).toBe('DFLT')
  })

  it('offers the predicate keys that never reached payload.data', async () => {
    const nuxtApp = useNuxtApp()
    await useAsyncData(uniqueKey, () => Promise.resolve('secret'), { serialize: false })

    expect(uniqueKey in nuxtApp.payload.data).toBe(false)

    const seen: string[] = []
    clearNuxtData((key) => {
      seen.push(key)
      return true
    })

    expect(seen).toContain(uniqueKey)
    expect(nuxtApp._asyncData[uniqueKey]?.data.value).toBeUndefined()
  })
})
