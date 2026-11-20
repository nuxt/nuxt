import { afterEach, describe, expect, it, vi } from 'vitest'
import { H3 } from 'nitro/h3'

const flags = vi.hoisted(() => ({ legacyResponseHeaders: false }))
vi.mock('#nuxt-compat/flags', () => flags)

const { defineCachedEventHandler } = await import('../src/runtime/compat/cache.ts')

function createStorage () {
  const entries = new Map<string, unknown>()
  return {
    get: (key: string) => structuredClone(entries.get(key)),
    set: (key: string, value: unknown) => {
      if (value === null) {
        entries.delete(key)
      } else {
        entries.set(key, structuredClone(value))
      }
    },
  }
}

async function fetchFrom (handler: unknown) {
  const app = new H3()
  app.get('/**', handler as any)
  const response = await app.fetch(new Request('http://localhost/data'))
  return response.text()
}

describe('nitro v2 cached handler entries', () => {
  it.each([false, true])('are not served once the handler changes (legacy response headers: %s)', async (legacyResponseHeaders) => {
    flags.legacyResponseHeaders = legacyResponseHeaders
    const storage = createStorage()
    const options = { maxAge: 60, name: 'data', storage } as any

    expect(await fetchFrom(defineCachedEventHandler(() => 'first', options))).toBe('first')
    expect(await fetchFrom(defineCachedEventHandler(() => 'first', options))).toBe('first')
    expect(await fetchFrom(defineCachedEventHandler(() => 'second', options))).toBe('second')
  })

  it('are served while the handler is unchanged', async () => {
    flags.legacyResponseHeaders = false
    const storage = createStorage()
    const options = { maxAge: 60, name: 'data', storage } as any
    let calls = 0
    const handler = () => `call ${++calls}`

    expect(await fetchFrom(defineCachedEventHandler(handler, options))).toBe('call 1')
    expect(await fetchFrom(defineCachedEventHandler(handler, options))).toBe('call 1')
  })

  it('follow the `integrity` the caller sets', async () => {
    flags.legacyResponseHeaders = false
    const storage = createStorage()
    const options = { maxAge: 60, name: 'data', storage, integrity: 'v1' } as any

    expect(await fetchFrom(defineCachedEventHandler(() => 'first', options))).toBe('first')
    expect(await fetchFrom(defineCachedEventHandler(() => 'second', options))).toBe('first')
  })
})

describe('nitro v2 cached handler revalidation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    [false, 'no options', undefined],
    [true, 'no options', undefined],
    [false, 'options without `swr`', { maxAge: 1, name: 'swr-default' }],
  ])('serves an expired entry while the handler fails (legacy response headers: %s, %s)', async (legacyResponseHeaders, _, options) => {
    flags.legacyResponseHeaders = legacyResponseHeaders
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = false
    const handler = defineCachedEventHandler(() => {
      if (fail) { throw new Error('unavailable') }
      return 'fresh'
    }, options ? { ...options, storage: createStorage() } as any : undefined)
    const app = new H3()
    app.get('/**', handler as any)
    const path = `http://localhost/revalidate/${legacyResponseHeaders}/${options?.name}`

    expect(await (await app.fetch(new Request(path))).text()).toBe('fresh')
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 5000 })
    fail = true
    const stale = await app.fetch(new Request(path))

    expect([stale.status, await stale.text()]).toEqual([200, 'fresh'])
  })

  it('does not serve an expired entry with `swr: false`', async () => {
    flags.legacyResponseHeaders = false
    let calls = 0
    const handler = defineCachedEventHandler(() => `call ${++calls}`, { maxAge: 1, swr: false, name: 'no-swr', storage: createStorage() } as any)
    const app = new H3()
    app.get('/**', handler as any)

    expect(await (await app.fetch(new Request('http://localhost/no-swr'))).text()).toBe('call 1')
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 5000 })
    expect(await (await app.fetch(new Request('http://localhost/no-swr'))).text()).toBe('call 2')
  })
})
