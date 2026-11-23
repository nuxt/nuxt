import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createStorage } from 'unstorage'

const storage = createStorage()

vi.mock('nitropack/runtime', () => ({ useStorage: () => storage }))
vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: true }))

describe('shared prerender cache', () => {
  beforeAll(() => vi.stubGlobal('__TEST_PRERENDER__', true))
  afterAll(() => vi.unstubAllGlobals())

  it('shares an in-flight request and persists its successful result', async () => {
    const { sharedPrerenderCache } = await import('../src/runtime/utils/cache.ts')
    const cache = sharedPrerenderCache!
    let resolveRequest!: (value: { ok: boolean }) => void
    const request = new Promise<{ ok: boolean }>((resolve) => { resolveRequest = resolve })
    const writing = cache.set('successful-request', request)

    expect(cache.get('successful-request')).toBe(request)
    resolveRequest({ ok: true })
    await writing
    await expect(cache.get('successful-request')).resolves.toEqual({ ok: true })
  })

  it('shares an in-flight rejection and permits a later retry', async () => {
    const { sharedPrerenderCache } = await import('../src/runtime/utils/cache.ts')
    const cache = sharedPrerenderCache!
    let rejectRequest!: (error: Error) => void
    const request = new Promise<never>((_, reject) => { rejectRequest = reject })
    const writing = cache.set('pending-failure', request)
    const waiting = expect(cache.get('pending-failure')).rejects.toThrow('temporary failure')

    rejectRequest(new Error('temporary failure'))
    await waiting
    await writing
    expect(cache.get('pending-failure')).toBeUndefined()
    await cache.set('pending-failure', Promise.resolve('recovered'))
    await expect(cache.get('pending-failure')).resolves.toBe('recovered')
  })

  it('allows a later read to retry after a rejected request', async () => {
    const { sharedPrerenderCache } = await import('../src/runtime/utils/cache.ts')
    const cache = sharedPrerenderCache!

    await cache.set('failed-request', Promise.reject(new Error('temporary failure')))
    expect(cache.get('failed-request')).toBeUndefined()

    await cache.set('failed-request', Promise.resolve({ ok: true }))
    await expect(cache.get('failed-request')).resolves.toEqual({ ok: true })
  })
})
