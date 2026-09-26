/// <reference path="../fixtures/basic/.nuxt/nuxt.d.ts" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app/nuxt'
import { loadPayload } from '#app/composables/payload'
import { preloadRouteComponents } from '#app/composables/preload'
import { useRouter } from '#app/composables/router'
import { usePrefetchScheduler } from '#app/internal/prefetch-scheduler'
import type { PrefetchScheduler } from '#app/internal/prefetch'

// the test environment builds with `ssr: false`, which disables payload extraction
vi.mock('#build/nuxt.config.mjs', async importOriginal => ({
  ...await importOriginal<Record<string, unknown>>(),
  payloadExtraction: true,
}))

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))

function scheduleProbe (scheduler: PrefetchScheduler, key: string, started: string[]) {
  scheduler.schedule({
    key,
    priority: 'payload',
    scope: 'app',
    run: (signal) => {
      if (!signal.aborted) { started.push(key) }
    },
  })
}

describe('prefetch scheduler navigation state', () => {
  let scheduler: PrefetchScheduler
  let started: string[]

  beforeEach(async () => {
    const nuxtApp = useNuxtApp()
    delete nuxtApp._prefetch
    scheduler = usePrefetchScheduler(nuxtApp)
    started = []
    await useRouter().push('/')
    await tick()
  })

  afterEach(async () => {
    await useRouter().push('/')
  })

  it('should hold prefetch work while a navigation is in progress', async () => {
    const router = useRouter()
    let release: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const removeGuard = router.beforeEach(() => blocked)

    const navigation = router.push('/index')
    await tick()

    scheduleProbe(scheduler, 'payload:/held', started)
    await tick()
    expect(started).toEqual([])

    release!()
    await navigation
    await tick()

    expect(started).toEqual(['payload:/held'])
    removeGuard()
  })

  it('should settle an awaited route preload while the queue is held', async () => {
    const router = useRouter()
    let release: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const removeGuard = router.beforeEach(() => blocked)

    const navigation = router.push('/index')
    await tick()

    await expect(preloadRouteComponents('/index')).resolves.toBeUndefined()

    release!()
    await navigation
    removeGuard()
  })

  it('should resume prefetch work after a navigation is aborted', async () => {
    const router = useRouter()
    const removeGuard = router.beforeEach(() => false)

    await router.push('/index')
    await tick()

    scheduleProbe(scheduler, 'payload:/after-abort', started)
    await tick()

    expect(started).toEqual(['payload:/after-abort'])
    removeGuard()
  })
})

describe('payload prefetch deduplication', () => {
  const payloadResponse = () => new Response('[{"data":1},{}]')

  it('should join a payload request that is already in flight', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(payloadResponse()))
    try {
      const [speculative, navigation] = await Promise.all([
        loadPayload('/pre/thing', { signal: new AbortController().signal }),
        loadPayload('/pre/thing'),
      ])

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(navigation).toEqual(speculative)
      expect(navigation).not.toBeNull()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('should not hand an aborted speculative fetch to a caller that did not abort', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      if ((init as RequestInit)?.signal?.aborted) {
        return Promise.reject(new DOMException('aborted', 'AbortError'))
      }
      return Promise.resolve(payloadResponse())
    })
    try {
      controller.abort()
      const speculative = loadPayload('/pre/thing', { signal: controller.signal })
      const navigation = loadPayload('/pre/thing')

      expect(await speculative).toBeNull()
      expect(await navigation).not.toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('should keep a payload that arrived before its caller aborted', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve({
      ok: true,
      // the caller aborts between the response arriving and the payload being handed back
      text: () => {
        controller.abort()
        return Promise.resolve('[{"data":1},{}]')
      },
    } as unknown as Response))
    try {
      const speculative = loadPayload('/pre/thing', { signal: controller.signal })
      const navigation = loadPayload('/pre/thing')

      expect(await speculative).not.toBeNull()
      expect(await navigation).not.toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('should bypass the in-flight map for a fresh payload', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(payloadResponse()))
    try {
      await Promise.all([
        loadPayload('/pre/thing', { fresh: true }),
        loadPayload('/pre/thing', { fresh: true }),
      ])

      expect(fetchSpy).toHaveBeenCalledTimes(2)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
