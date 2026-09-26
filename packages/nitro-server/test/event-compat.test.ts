/* eslint-disable @typescript-eslint/no-deprecated -- the v1 `event.node` bridge is what is under test */
import { describe, expect, it, vi } from 'vitest'
import { mockEvent } from 'nitro/h3'

import plugin from '../src/runtime/compat/event-plugin.ts'
import { decorateLegacyEvent } from '../src/runtime/compat/decorate.ts'
import { prepareLegacyEvent } from '../src/runtime/compat/event.ts'
import { wrapLegacyHandler } from '../src/runtime/compat/wrapper.ts'

vi.mock('nitro/app', () => ({
  fetch: vi.fn(() => Promise.resolve(new Response())),
  getRouteRules: vi.fn((_method: string, pathname: string) => ({ routeRules: { matched: pathname }, routeRuleMiddleware: [] })),
}))

function decorate (event: any, app?: { fetch: (request: Request) => Promise<Response> }) {
  const handlers = new Map<string, (...args: any[]) => any>()
  plugin({ hooks: { hook: (name: string, handler: any) => handlers.set(name, handler) } } as any)
  event.app = app
  handlers.get('request')!(event)
  return event
}

describe('v2 event decoration', () => {
  it.each([
    ['/api/inner'],
    ['/a/../api/inner'],
    ['/api/inner?q=1'],
  ])('still dispatches %s into the running app', async (target: string) => {
    const app = { fetch: vi.fn((_request: Request) => Promise.resolve(new Response('ok'))) }
    const event = decorate(mockEvent('http://nuxt/api/outer'), app)

    await event.fetch(target)

    expect(app.fetch).toHaveBeenCalledTimes(1)
    expect(new URL(app.fetch.mock.calls[0]![0]!.url).host).toBe('nuxt')
  })

  it('keeps the method and body of a `Request` sent to another origin', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('external'))
    const event = decorate(mockEvent('http://nuxt/api/outer'), { fetch: () => Promise.resolve(new Response()) })

    await event.fetch(new Request('https://api.example/inner', { method: 'PUT', body: 'payload' }))

    const sent = fetchSpy.mock.calls[0]![0] as Request
    expect(sent.method).toBe('PUT')
    expect(await sent.text()).toBe('payload')
    fetchSpy.mockRestore()
  })

  it('dispatches a path into the running app', async () => {
    const app = { fetch: vi.fn((_request: Request) => Promise.resolve(new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }))) }
    const event = decorate(mockEvent('http://nuxt/api/outer', { headers: { cookie: 'session=abc' } }), app)

    expect(await event.$fetch('/api/inner')).toEqual({ ok: true })
    expect(app.fetch).toHaveBeenCalledTimes(1)
    expect(new URL(app.fetch.mock.calls[0]![0]!.url).host).toBe('nuxt')
  })

  it.each([
    ['//evil.example/steal'],
    // WHATWG URL normalises a backslash for special schemes
    ['/\\evil.example/steal'],
    ['/\\/evil.example/steal'],
    // ... and dot-segment removal turns these into a protocol-relative pathname,
    // which is same-origin when resolved here and another origin when h3 resolves
    // the pathname again
    ['/.//evil.example/steal'],
    ['/..//evil.example/steal'],
    ['/./..//evil.example/steal'],
    ['/a/../..//evil.example/steal'],
    ['/..\\/evil.example/steal'],
    ['/..//..//evil.example/steal'],
    ['/..//\\evil.example/steal'],
    ['/..////evil.example/steal'],
    ['/..//evil.example:8443/steal'],
    ['https://evil.example/steal'],
    ['not-a-path'],
  ])('does not couple the event to %s', async (target: string) => {
    const app = { fetch: vi.fn((_request: Request) => Promise.resolve(new Response('nope'))) }
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('external'))
    const event = decorate(mockEvent('http://nuxt/api/outer', { headers: { cookie: 'session=abc' } }), app)

    await event.fetch(target).catch(() => {})

    expect(app.fetch).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledWith(target, undefined)
    fetchSpy.mockRestore()
  })

  it('falls back to plain fetch when the event has no app', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('external'))
    const event = decorate(mockEvent('http://nuxt/api/outer'))

    await event.fetch('/api/inner')

    expect(fetchSpy).toHaveBeenCalledWith('/api/inner', undefined)
    fetchSpy.mockRestore()
  })
})

describe('v2 event bridge', () => {
  it('reports request headers live rather than snapshotting them', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    event.req.headers.set('x-late', 'yes')

    expect((event.node!.req as any).headers['x-late']).toBe('yes')
  })

  it('reports the path a mounted handler sees, and the path the request arrived on', async () => {
    const seen: Array<Record<string, string>> = []
    const wrapped = wrapLegacyHandler((event: any) => {
      seen.push({ url: event.node.req.url, originalUrl: event.node.req.originalUrl })
      return undefined
    }, '/_mw') as (event: any) => unknown

    await wrapped(mockEvent('http://nuxt/_mw/deep?q=1'))

    expect(seen).toEqual([{ url: '/deep?q=1', originalUrl: '/_mw/deep?q=1' }])
  })

  it('exposes the matched route rules at `event.context._nitro.routeRules`', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/robots.txt'))
    ;(event.context as any).routeRules = { site: { url: 'https://example.com' } }

    expect((event.context as any)._nitro.routeRules).toEqual({ site: { url: 'https://example.com' } })
  })

  it('resolves route rules from the app when the context has none yet', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/late'))

    expect((event.context as any)._nitro.routeRules).toEqual({ matched: '/late' })
  })

  it('replaces every value of a header on `setHeader`, as node does', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    const res = event.node!.res as any

    res.setHeader('set-cookie', ['a=1', 'b=2'])
    res.setHeader('set-cookie', ['c=3'])
    res.setHeader('x-single', 'first')
    res.setHeader('x-single', 'second')

    expect(event.res.headers.getSetCookie()).toEqual(['c=3'])
    expect(event.res.headers.get('x-single')).toBe('second')
  })

  it('reports repeated `set-cookie` values as an array from `getHeaders`', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    const res = event.node!.res as any

    res.setHeader('set-cookie', ['a=1', 'b=2'])
    res.setHeader('x-single', 'one')

    expect(res.getHeaders()).toEqual({ 'set-cookie': ['a=1', 'b=2'], 'x-single': 'one' })
  })

  it('appends to a header on `appendHeader`, one entry per value', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    const res = event.node!.res as any

    res.setHeader('set-cookie', 'a=1')
    res.appendHeader('set-cookie', ['b=2', 'c=3'])

    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2', 'c=3'])
    expect(res.getHeader('set-cookie')).toEqual(['a=1', 'b=2', 'c=3'])
  })

  it('writes each value of a multi-value header given to `writeHead`', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    const res = event.node!.res as any

    res.writeHead(200, { 'set-cookie': ['a=1', 'b=2'], 'x-count': 3 })

    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(event.res.headers.get('x-count')).toBe('3')
  })

  it('does not clobber a `_nitro` slot the handler chain already set', () => {
    const event = mockEvent('http://nuxt/x')
    ;(event.context as any)._nitro = { routeRules: { own: true } }
    prepareLegacyEvent(event)

    expect((event.context as any)._nitro.routeRules).toEqual({ own: true })
  })
})

describe('wrapLegacyHandler', () => {
  it('carries over handler markers, including symbols', () => {
    const marker = Symbol('marker')
    const input = Object.assign(function handler () { return 'ok' }, { middleware: true, route: '/x', [marker]: 1 })

    const wrapped = wrapLegacyHandler(input) as any

    expect(wrapped.middleware).toBe(true)
    expect(wrapped.route).toBe('/x')
    expect(wrapped[marker]).toBe(1)
    expect(typeof wrapped.fetch).toBe('function')
  })

  it.each([
    ['/_mw/deep?q=1', '/deep?q=1'],
    ['/_mw', '/'],
  ])('strips the base a middleware was mounted at from %s, and restores it', async (target: string, expected: string) => {
    const paths: string[] = []
    const wrapped = wrapLegacyHandler((event: any) => {
      paths.push(event.path)
      return undefined
    }, '/_mw') as (event: any) => unknown

    const event = mockEvent(`http://nuxt${target}`)
    await wrapped(event)

    expect(paths).toEqual([expected])
    expect(event.path).toBe(target)
  })

  it('leaves the path alone for a request outside the base', async () => {
    const paths: string[] = []
    const wrapped = wrapLegacyHandler((event: any) => {
      paths.push(event.path)
      return undefined
    }, '/_mw-other') as (event: any) => unknown

    await wrapped(mockEvent('http://nuxt/_mw-otherwise/deep'))

    expect(paths).toEqual(['/_mw-otherwise/deep'])
  })
})

describe('v2 globals', () => {
  it('seeds `globalThis.$fetch`, which v2 module code calls without an event', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, '$fetch')
    delete (globalThis as { $fetch?: unknown }).$fetch

    try {
      plugin({ hooks: { hook: () => {} } } as any)

      const $fetch = (globalThis as { $fetch?: any }).$fetch
      expect(typeof $fetch).toBe('function')
      expect(typeof $fetch.raw).toBe('function')
    } finally {
      delete (globalThis as { $fetch?: unknown }).$fetch
      if (previous) {
        Object.defineProperty(globalThis, '$fetch', previous)
      }
    }
  })
})

describe('decorateLegacyEvent', () => {
  it('dispatches sub-requests for an event built outside h3 routing', async () => {
    const h3 = { fetch: vi.fn((_request: Request) => Promise.resolve(new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }))) }
    const event = mockEvent('http://nuxt/') as any

    decorateLegacyEvent(event, { h3 } as any)

    expect(await event.$fetch('/__probe')).toEqual({ ok: true })
    expect(new URL(h3.fetch.mock.calls[0]![0]!.url).pathname).toBe('/__probe')
  })

  it('does not replace an app the event already has', () => {
    const own = { fetch: vi.fn() }
    const event = mockEvent('http://nuxt/') as any
    event.app = own

    decorateLegacyEvent(event, { h3: { fetch: vi.fn() } } as any)

    expect(event.app).toBe(own)
  })
})
