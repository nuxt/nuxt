import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createStorage } from 'unstorage'

const storage = createStorage()

vi.mock('nitro/kv', () => ({ useKV: () => storage }))
vi.mock('#internal/nuxt/nitro-config.mjs', () => ({ NUXT_SHARED_DATA: true }))

describe('sharedPrerenderCache', () => {
  beforeAll(() => {
    vi.stubGlobal('__TEST_PRERENDER__', true)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  async function useCache () {
    const { sharedPrerenderCache } = await import('../src/runtime/utils/cache.ts')
    return sharedPrerenderCache!
  }

  it('returns the persisted value once the shared promise resolves', async () => {
    const cache = await useCache()
    await cache.set('resolved', Promise.resolve({ title: 'shared' }))
    await expect(cache.get('resolved')).resolves.toEqual({ title: 'shared' })
  })

  it('returns undefined for a key whose value rejected', async () => {
    const cache = await useCache()
    await cache.set('rejected', Promise.reject(new Error('failed')))
    expect(cache.get('rejected')).toBeUndefined()
  })
})
