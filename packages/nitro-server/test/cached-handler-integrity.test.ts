import { describe, expect, it, vi } from 'vitest'
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
