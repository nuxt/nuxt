import { describe, expect, it, vi } from 'vitest'
import { createHooks } from 'hookable'
import { H3Event } from 'nitro/h3'
import type { NitroApp } from 'nitro/types'

const { flags, defined } = vi.hoisted(() => ({
  flags: { legacyResponseHeaders: false },
  defined: [] as Array<Record<string, any> | undefined>,
}))

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))
vi.mock('#nuxt-compat/flags', () => ({
  get legacyResponseHeaders () { return flags.legacyResponseHeaders },
}))
vi.mock('nitro/cache', () => ({
  defineCachedHandler: (handler: unknown, options?: Record<string, any>) => {
    defined.push(options)
    return handler
  },
  defineCachedFunction: (fn: unknown, options?: Record<string, any>) => {
    defined.push(options)
    return fn
  },
}))

const { cachedEventHandler, cachedFunction, defineCachedEventHandler, defineCachedFunction, legacyCacheControl } = await import('../src/runtime/compat/cache.ts')
const { default: plugin } = await import('../src/runtime/compat/cache-control-plugin.ts')

function optionsOf (options?: Record<string, any>, define = defineCachedEventHandler) {
  defined.length = 0
  define(() => ({}), options)
  return defined[0]
}

function sentCacheControl (options: Record<string, any> | undefined, served?: string) {
  flags.legacyResponseHeaders = true
  const resolved = optionsOf(options)!
  const event = new H3Event(new Request('http://localhost/api'))
  resolved.handleCacheHeaders(event, { maxAge: options?.maxAge ?? 1 })
  const response: Response = resolved.createResponse('{}', { headers: served ? { 'cache-control': served } : {} })
  return event.res.headers.get('cache-control') ?? response.headers.get('cache-control')
}

describe('legacyCacheControl', () => {
  it.each([
    [{ maxAge: 60 }, 'max-age=60'],
    [{ swr: true, maxAge: 300 }, 's-maxage=300, stale-while-revalidate'],
    [{ swr: true, maxAge: 60, staleMaxAge: 30 }, 's-maxage=60, stale-while-revalidate=30'],
    [{ swr: true }, 'stale-while-revalidate'],
    [{}, undefined],
  ])('is what Nitro v2 wrote for %o', (options, expected) => {
    expect(legacyCacheControl(options)).toBe(expected)
  })
})

describe('nitro v2 cached handlers', () => {
  it.each([['defineCachedEventHandler', defineCachedEventHandler], ['cachedEventHandler', cachedEventHandler]] as const)('pass the options of `%s` on as given without the Nitro v2 `cache-control`', (_name, define) => {
    flags.legacyResponseHeaders = false
    const options = { maxAge: 60 }
    expect(optionsOf(options, define)).toEqual({ ...options, swr: true, toResponse: expect.any(Function) })
  })

  it('send the `cache-control` of Nitro v2 with it', () => {
    expect(sentCacheControl({ maxAge: 60 })).toBe('max-age=60')
    expect(sentCacheControl({ swr: true, maxAge: 300 })).toBe('s-maxage=300, stale-while-revalidate')
    expect(sentCacheControl(undefined)).toBe('s-maxage=1, stale-while-revalidate')
    expect(sentCacheControl({ name: 'unbounded' })).toBe('public')
    expect(optionsOf({ maxAge: 60 })).toMatchObject({ maxAge: 60, sendCacheControl: false })
  })

  it('keep the `cache-control` of a handler where it forbids shared caching or the options set none', () => {
    expect(sentCacheControl({ maxAge: 60 }, 'private, max-age=7')).toBe('private, max-age=7')
    expect(sentCacheControl({ maxAge: 60 }, 'max-age=7')).toBe('max-age=60')
    expect(sentCacheControl({ name: 'unbounded' }, 'max-age=7')).toBe('max-age=7')
  })

  it('leave options that control the header alone', () => {
    flags.legacyResponseHeaders = true
    for (const options of [{ maxAge: 60, sendCacheControl: true }, { maxAge: 60, sendCacheControl: false }, { maxAge: 60, headersOnly: true }, { maxAge: 60, stream: true }]) {
      expect(optionsOf(options)).toEqual({ ...options, swr: true, toResponse: expect.any(Function) })
    }
  })
})

describe('nitro v2 cached functions', () => {
  it.each([['defineCachedFunction', defineCachedFunction], ['cachedFunction', cachedFunction]] as const)('serve an expired entry with `%s` unless `swr` is `false`', (_name, define) => {
    defined.length = 0
    define(() => 'value', { maxAge: 60 })
    expect(defined[0]).toEqual({ maxAge: 60, swr: true })

    defined.length = 0
    define(() => 'value', { maxAge: 60, swr: false })
    expect(defined[0]).toEqual({ maxAge: 60, swr: false })
  })
})

describe('route rule cache-control plugin', () => {
  const hooks = createHooks<Record<string, (response: Response, event: unknown) => void>>()
  ;(plugin as (app: NitroApp) => void)({ hooks } as unknown as NitroApp)

  async function respond (routeRules: Record<string, any> | undefined, cacheControl = 'public, max-age=60, s-maxage=60', status = 200, init?: RequestInit) {
    const response = new Response(null, { status, headers: { 'cache-control': cacheControl } })
    await hooks.callHook('response', response, { req: new Request('http://localhost/api', init), context: { routeRules } })
    return response.headers.get('cache-control')
  }

  it('sends the `cache-control` of Nitro v2 for a cache rule', async () => {
    expect(await respond({ cache: { swr: true, maxAge: 60 } })).toBe('s-maxage=60, stale-while-revalidate')
    expect(await respond({ cache: { maxAge: 60 } })).toBe('max-age=60')
    expect(await respond({ cache: { swr: true, maxAge: 60, staleMaxAge: 30 } })).toBe('s-maxage=60, stale-while-revalidate=30')
    expect(await respond({ cache: {} }, 'public, max-age=1, s-maxage=1')).toBe('public')
  })

  it('keeps any other `cache-control`', async () => {
    expect(await respond(undefined)).toBe('public, max-age=60, s-maxage=60')
    expect(await respond({ cache: { swr: true, maxAge: 60 } }, 'private, max-age=7')).toBe('private, max-age=7')
    expect(await respond({ cache: {} }, 'private, max-age=7')).toBe('private, max-age=7')
    expect(await respond({ cache: { swr: true, maxAge: 60, sendCacheControl: true } })).toBe('public, max-age=60, s-maxage=60')
    expect(await respond({ cache: { swr: true, maxAge: 60 }, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } })).toBe('public, max-age=60, s-maxage=60')
    expect(await respond({ cache: { swr: true, maxAge: 60 } }, 'public, max-age=60, s-maxage=60', 304)).toBe('public, max-age=60, s-maxage=60')
  })

  it('keeps the `cache-control` of a request the cache rule passes to the handler', async () => {
    expect(await respond({ cache: { swr: true, maxAge: 300 } }, 'public, max-age=60, s-maxage=60', 206, { headers: { range: 'bytes=0-1' } })).toBe('public, max-age=60, s-maxage=60')
    expect(await respond({ cache: { swr: true, maxAge: 300 } }, 'public, max-age=60, s-maxage=60', 200, { method: 'POST' })).toBe('public, max-age=60, s-maxage=60')
    expect(await respond({ cache: { swr: true, maxAge: 60 } }, 'public, max-age=60, s-maxage=60', 200, { method: 'HEAD' })).toBe('s-maxage=60, stale-while-revalidate')
  })
})
