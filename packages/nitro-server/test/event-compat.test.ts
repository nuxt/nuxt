/* eslint-disable @typescript-eslint/no-deprecated -- the v1 `event.node` bridge is what is under test */
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { H3, H3Event, mockEvent } from 'nitro/h3'

import plugin from '../src/runtime/compat/event-plugin.ts'
import { decorateLegacyEvent } from '../src/runtime/compat/decorate.ts'
import { fromLegacyBody, prepareLegacyEvent } from '../src/runtime/compat/event.ts'
import { defineEventHandler as defineLegacyEventHandler } from '../src/runtime/compat/h3-v1.ts'
import { sendStream } from '../src/runtime/compat/h3-v1-app.ts'
import { wrapLegacyHandler } from '../src/runtime/compat/wrapper.ts'
import { getRouteRules } from '../src/runtime/utils/route-rules.ts'

vi.mock('nitro/app', () => ({
  fetch: vi.fn(() => Promise.resolve(new Response())),
  getRouteRules: vi.fn((_method: string, pathname: string) => ({ routeRules: { matched: pathname }, routeRuleMiddleware: [] })),
}))

function nodeEvent (path = '/api/test') {
  const req = new IncomingMessage(new Socket())
  req.url = path
  const res = new ServerResponse(req)
  const event = mockEvent(`http://nuxt${path}`)
  Object.defineProperty(event.req, 'runtime', { value: { name: 'node', node: { req, res } } })
  return { event: prepareLegacyEvent(event), req, res }
}

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

  it('marks a sub-request made while rendering an error page, without sharing other request state', async () => {
    const app = { fetch: vi.fn((_request: Request) => Promise.resolve(new Response('ok'))) }
    const event = decorate(mockEvent('http://nuxt/api/outer'), app)
    event.context.nuxt = { '~rendering-error': true, '~internal': true, 'prerenderRoutes': ['/outer'] }

    await event.$fetch('/api/inner')

    expect((app.fetch.mock.calls[0]![0] as Request & { context?: any }).context?.nuxt).toEqual({ '~rendering-error': true })
  })

  it('dispatches a sub-request of a node request as an in-process request', async () => {
    const seen: Array<Record<string, unknown>> = []
    const app = {
      fetch: vi.fn((request: Request) => {
        const inner = prepareLegacyEvent(new H3Event(request))
        seen.push({ url: inner.node!.req.url, readyState: (inner.node!.req.socket as any).readyState })
        return Promise.resolve(new Response('ok'))
      }),
    }
    const { event } = nodeEvent('/api/outer')

    await decorate(event, app).fetch('/api/inner')

    expect(seen).toEqual([{ url: '/api/inner', readyState: 'readOnly' }])
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
    const event = prepareLegacyEvent(mockEvent('http://nuxt/late'), getRouteRules)

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

  it('routes headers and status set on a node response to the web response', () => {
    const { event, req, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    bridged.setHeader('set-cookie', ['a=1']).appendHeader('set-cookie', 'b=2')
    bridged.setHeader('x-node', 'node')
    bridged.statusCode = 404
    event.res.headers.append('set-cookie', 'c=3')

    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2', 'c=3'])
    expect(event.res.headers.get('x-node')).toBe('node')
    expect(event.res.status).toBe(404)
    expect(bridged.getHeader('set-cookie')).toEqual(['a=1', 'b=2', 'c=3'])
    expect(bridged.statusCode).toBe(404)
    expect(res.getHeaders()).toEqual({ 'set-cookie': ['a=1', 'b=2'], 'x-node': 'node' })
    expect(event.node!.req).toBe(req)
    expect(prepareLegacyEvent(event).node!.res).toBe(bridged)
  })

  it('reads headers from both the node and the web response', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse
    res.setHeader('x-early', 'early')
    event.res.headers.set('x-web', 'web')

    expect(bridged.getHeader('x-early')).toBe('early')
    expect(bridged.hasHeader('x-early')).toBe(true)
    expect(bridged.hasHeader('x-web')).toBe(true)
    expect(bridged.getHeaders()).toEqual({ 'x-early': 'early', 'x-web': 'web' })
    expect(bridged.getHeaderNames()).toEqual(['x-early', 'x-web'])

    bridged.removeHeader('x-early')
    bridged.removeHeader('x-web')
    expect(res.hasHeader('x-early')).toBe(false)
    expect(event.res.headers.has('x-web')).toBe(false)
  })

  it('writes the status and headers onto a node response a handler writes itself', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    bridged.setHeader('set-cookie', ['a=1'])
    event.res.headers.set('x-web', 'web')
    bridged.statusCode = 201
    bridged.statusMessage = 'Created'
    bridged.write('ok')
    bridged.end()
    event.res.status = 500

    expect(res.headersSent).toBe(true)
    expect(res.statusCode).toBe(201)
    expect(res.statusMessage).toBe('Created')
    expect(res.getHeader('set-cookie')).toEqual(['a=1'])
    expect(res.getHeader('x-web')).toBe('web')
    expect(bridged.statusCode).toBe(201)
  })

  it('writes the status and headers before a chained write', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    event.res.status = 201
    event.res.headers.set('x-web', 'web')
    bridged.on('finish', () => {}).end('ok')

    expect(res.statusCode).toBe(201)
    expect(res.getHeader('x-web')).toBe('web')
  })

  it('replaces headers passed to `setHeaders` on the web response', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    bridged.setHeader('content-type', 'text/plain')
    const headers = new Headers({ 'content-type': 'application/json' })
    headers.append('set-cookie', 'a=1')
    headers.append('set-cookie', 'b=2')
    expect(bridged.setHeaders(headers)).toBe(bridged)

    expect(event.res.headers.get('content-type')).toBe('application/json')
    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    bridged.end()
    expect(res.getHeader('content-type')).toBe('application/json')
  })

  it('appends to a header that is only on the node response', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    res.setHeader('set-cookie', ['a=1'])
    bridged.appendHeader('set-cookie', 'b=2')

    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
    expect(bridged.getHeader('set-cookie')).toEqual(['a=1', 'b=2'])
  })

  it('keeps the status and headers on the node response for handlers that write to it directly', () => {
    const { event, res } = nodeEvent()
    const bridged = event.node!.res as ServerResponse

    bridged.setHeader('set-cookie', ['a=1']).appendHeader('set-cookie', 'b=2')
    bridged.statusCode = 201
    bridged.statusMessage = 'Created'
    res.end('ok')

    expect(res.statusCode).toBe(201)
    expect(res.statusMessage).toBe('Created')
    expect(res.getHeader('set-cookie')).toEqual(['a=1', 'b=2'])
    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])
  })

  it('bridges the response of a node request that has none, keeping the node request', () => {
    const req = new IncomingMessage(new Socket())
    const event = mockEvent('http://nuxt/_ws')
    Object.defineProperty(event.req, 'runtime', { value: { name: 'node', node: { req, upgrade: {} } } })
    prepareLegacyEvent(event)

    expect(event.node!.req).toBe(req)
    event.node!.res!.setHeader('x-legacy', 'yes')
    event.node!.res!.statusCode = 401

    expect(event.res.headers.get('x-legacy')).toBe('yes')
    expect(event.res.status).toBe(401)
  })

  it('gives a request without a node socket the read-only socket of an in-process request', () => {
    const event = mockEvent('http://nuxt/api/test')
    const req = prepareLegacyEvent(event).node!.req as any

    expect(req.socket).toMatchObject({ readyState: 'readOnly', destroyed: false, remoteAddress: undefined, encrypted: false })
    Object.defineProperty(event.req, 'ip', { value: '192.0.2.1' })
    expect(req.socket.remoteAddress).toBe('192.0.2.1')
    expect(req.connection).toBe(req.socket)
    expect(req.socket.setTimeout(0).setNoDelay(true).setKeepAlive(true)).toBe(req.socket)

    const secure = prepareLegacyEvent(mockEvent('https://nuxt/api/test')).node!.req as any
    expect(secure.socket.encrypted).toBe(true)
  })

  it('keeps the socket of a node request', () => {
    const { event, req } = nodeEvent()

    expect(event.node!.req.socket).toBe(req.socket)
  })

  it('does not clobber a `_nitro` slot the handler chain already set', () => {
    const event = mockEvent('http://nuxt/x')
    ;(event.context as any)._nitro = { routeRules: { own: true } }
    prepareLegacyEvent(event)

    expect((event.context as any)._nitro.routeRules).toEqual({ own: true })
  })

  it('exposes the matched route pattern at `event.context.matchedRoute.path`', async () => {
    const shared = new Set<Record<string, unknown>>()
    const app = new H3({ onRequest: event => void prepareLegacyEvent(event) })
    app.use((event) => { shared.add((event.context as any).matchedRoute) })
    app.get('/api/proxy/**:path', defineLegacyEventHandler((event) => {
      const route = (event.context as any).matchedRoute
      return `${route.path} ${{ ...route }.path}`
    }))
    app.get('/api/native', event => String((event.context as any).matchedRoute.path))

    expect(await (await app.request('/api/proxy/a/b')).text()).toBe('/api/proxy/**:path /api/proxy/**:path')
    expect(await (await app.request('/api/proxy/c')).text()).toBe('/api/proxy/**:path /api/proxy/**:path')
    expect(await (await app.request('/api/native')).text()).toBe('undefined')
    for (const data of shared) {
      expect(data.path).toBeUndefined()
    }
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

  it('sends a string a handler returns as HTML unless the handler sets a content type', async () => {
    const html = mockEvent('http://nuxt/page')
    await (wrapLegacyHandler(() => '<h1>ok</h1>') as (event: any) => unknown)(html)
    expect(html.res.headers.get('content-type')).toBe('text/html')

    const text = mockEvent('http://nuxt/robots.txt')
    await (wrapLegacyHandler((event: any) => {
      event.res.headers.set('content-type', 'text/plain')
      return 'ok'
    }) as (event: any) => unknown)(text)
    expect(text.res.headers.get('content-type')).toBe('text/plain')

    const passed = mockEvent('http://nuxt/_mw')
    await (wrapLegacyHandler(() => undefined) as (event: any) => unknown)(passed)
    expect(passed.res.headers.has('content-type')).toBe(false)
  })

  it('sends what a handler returns once an inner handler has turned its ended response into another', async () => {
    const wrapped = wrapLegacyHandler(async (event: any) => {
      const ended = fromLegacyBody(event, sendStream(event, new Response('streamed').body))
      return new Response(await new Response(ended as BodyInit).text())
    }) as { fetch: (request: Request) => Promise<Response> }

    const response = await wrapped.fetch(new Request('http://nuxt/api/cached'))

    expect(await response.text()).toBe('streamed')
  })

  it('answers a handler that returns `null` with no content, keeping a status it set', async () => {
    const empty = await (wrapLegacyHandler(() => null) as { fetch: (request: Request) => Promise<Response> }).fetch(new Request('http://nuxt/api/null'))
    expect(empty.status).toBe(204)
    expect(empty.headers.has('content-type')).toBe(false)

    const gone = await (wrapLegacyHandler((event: any) => {
      event.node.res.statusCode = 410
      return null
    }) as { fetch: (request: Request) => Promise<Response> }).fetch(new Request('http://nuxt/api/null'))
    expect(gone.status).toBe(410)
    expect(await gone.text()).toBe('')
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

  it('strips the base from a real node request for the handler, and restores it', async () => {
    const { event, req } = nodeEvent('/_mw/deep?q=1')
    const seen: Array<Record<string, unknown>> = []
    const wrapped = wrapLegacyHandler((event: any) => {
      seen.push({ path: event.path, url: event.node.req.url, originalUrl: event.node.req.originalUrl })
      return undefined
    }, '/_mw') as (event: any) => unknown

    await wrapped(event)

    expect(seen).toEqual([{ path: '/deep?q=1', url: '/deep?q=1', originalUrl: '/_mw/deep?q=1' }])
    expect(req.url).toBe('/_mw/deep?q=1')
    expect(event.path).toBe('/_mw/deep?q=1')
  })

  it('restores the url of a real node request when the handler throws', async () => {
    const { event, req } = nodeEvent('/_mw//deep')
    const seen: string[] = []
    const wrapped = wrapLegacyHandler((event: any) => {
      seen.push(event.node.req.url)
      throw new Error('boom')
    }, '/_mw') as (event: any) => unknown

    await expect(wrapped(event)).rejects.toThrow()

    expect(seen).toEqual(['//deep'])
    expect(req.url).toBe('/_mw//deep')
    expect(event.path).toBe('/_mw//deep')
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
