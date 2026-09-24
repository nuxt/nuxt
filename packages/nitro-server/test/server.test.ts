import { describe, expect, it, vi } from 'vitest'
import { resolve } from 'pathe'
import { resolveModuleExportNames } from '@nuxt/kit/internal'
import { createEvent } from 'h3'
import type { H3Event } from 'h3'
import * as shipped from '../../nuxt/src/server/index.ts'
import type { RequestEvent } from '../../nuxt/src/server/index.ts'

// the delegate re-exports nitro's own `getRouteRules`/`useRuntimeConfig`, which only resolve
// inside a built server bundle
vi.mock('nitropack/runtime', () => ({
  getRouteRules: () => ({}),
  useRuntimeConfig: () => ({}),
}))

const delegate = await import('../src/runtime/server.ts')
const { toPortableEvent } = await import('../src/runtime/utils/event.ts')

const delegatePath = resolve(import.meta.dirname, '../src/runtime/server.ts')

describe('the h3-backed `nuxt/server` implementations', () => {
  it('exports every name the portable surface does', async () => {
    const [surface, implemented] = await Promise.all([
      resolveModuleExportNames(resolve(import.meta.dirname, '../../nuxt/src/server/index.ts'), { url: import.meta.url }),
      resolveModuleExportNames(delegatePath, { url: import.meta.url }),
    ])

    expect(surface.length).toBeGreaterThan(0)
    expect(surface.filter(name => !implemented.includes(name))).toEqual([])
  })
})

/**
 * The delegate reads an h3 v1 event, where the shipped implementations read the
 * web-standard shape, so the two are only interchangeable if they agree on what they
 * return for the same request.
 */
describe('the shape of what it reads off an h3 v1 event', () => {
  /** The web-standard event the shipped implementations read, for comparing against. */
  function webEvent (url: string): RequestEvent {
    return {
      req: new Request(url),
      url: new URL(url),
      res: { headers: new Headers() },
      context: {},
    }
  }

  function event (path: string, options: { method?: string, headers?: Record<string, string>, ip?: string } = {}): H3Event {
    const headers: Record<string, string | string[] | undefined> = {}
    const req = { method: options.method || 'GET', url: path, headers: { host: 'nuxt.com', ...options.headers }, socket: { remoteAddress: options.ip } }
    const res = {
      statusCode: 200,
      statusMessage: undefined as string | undefined,
      setHeader: (name: string, value: string | string[]) => { headers[name] = value },
      getHeader: (name: string) => headers[name],
      getHeaders: () => headers,
      hasHeader: (name: string) => name in headers,
      removeHeader: (name: string) => { delete headers[name] },
    }
    return createEvent(req as never, res as never)
  }

  it('reads the request URL, headers and query', () => {
    const e = event('/api/hello?name=nuxt&tag=a&tag=b', { headers: { 'x-custom': 'value' } })

    expect(delegate.getRequestURL(e).pathname).toBe('/api/hello')
    expect(delegate.getRequestHeader(e, 'X-Custom')).toBe('value')
    expect(delegate.getRequestHeaders(e)).toMatchObject({ 'x-custom': 'value' })
    expect(delegate.getQuery(e)).toEqual({ name: 'nuxt', tag: ['a', 'b'] })
  })

  it('reads router params as they appear in the request URL, which nitropack routes decoded', () => {
    const e = event('/base/api/users/a%20b%2Fc/x%25y/z?page=1')
    Object.assign(e, { _path: '/api/users/a b%2Fc/x%25y/z?page=1' })
    e.context.matchedRoute = { path: '/api/users/:id/**:rest' } as never
    e.context.params = { id: 'a b%2Fc', rest: 'x%25y/z' }

    expect(delegate.getRouterParams(e)).toEqual({ id: 'a%20b%2Fc', rest: 'x%25y/z' })
    expect(delegate.getRouterParam(e, 'id', { decode: true })).toBe('a b%2Fc')
    expect(delegate.getRouterParam(e, 'rest', { decode: true })).toBe('x%y/z')
  })

  it('reads router params as h3 matched them when it cannot line them up with the URL', () => {
    const e = event('/api/users/a%20b')
    e.context.params = { id: 'a b' }
    expect(delegate.getRouterParams(e)).toEqual({ id: 'a b' })

    e.context.matchedRoute = { path: '/api/other/:id/:extra' } as never
    expect(delegate.getRouterParams(e)).toEqual({ id: 'a b' })
  })

  it('reads the client IP from the socket, and the first forwarded hop only when opted in', () => {
    const e = event('/', { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, ip: '198.51.100.7' })
    expect(delegate.getRequestIP(e)).toBe('198.51.100.7')
    expect(delegate.getRequestIP(e, { xForwardedFor: true })).toBe('203.0.113.1')
    expect(delegate.getRequestIP(event('/'))).toBeUndefined()
  })

  it('applies CORS through the node response, merging `vary`', () => {
    const e = event('/', { method: 'OPTIONS', headers: { 'origin': 'https://nuxt.com', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'x-custom' } })
    const response = delegate.handleCors(toPortableEvent(e), { origin: ['https://nuxt.com'], credentials: true })

    expect(response && response.status).toBe(204)
    expect(e.node.res.getHeader('access-control-allow-origin')).toBe('https://nuxt.com')
    expect(e.node.res.getHeader('access-control-allow-methods')).toBe('PUT')
    expect(e.node.res.getHeader('vary')).toBe('origin, access-control-request-method, access-control-request-headers')
  })

  it('reads a missing header as undefined rather than as an empty string', () => {
    expect(delegate.getRequestHeader(event('/'), 'x-missing')).toBeUndefined()
  })

  it('sets the status and reason phrase', () => {
    const e = event('/')
    delegate.setResponseStatus(e, 418, 'Teapot')
    expect(e.node.res.statusCode).toBe(418)
    expect(e.node.res.statusMessage).toBe('Teapot')
  })

  it('sets and reads cookies', () => {
    const e = event('/', { headers: { cookie: 'a=1; b=2' } })
    expect(delegate.getCookie(e, 'b')).toBe('2')

    delegate.setCookie(e, 'c', '3')
    expect(e.node.res.getHeader('set-cookie')).toBe('c=3; Path=/')
  })

  it('constructs an error h3 v1 recognises, readable under both majors\' names', () => {
    const error = delegate.createError({ status: 404, statusText: 'Not Found' })

    expect((error.constructor as { __h3_error__?: boolean }).__h3_error__).toBe(true)
    expect(error).toMatchObject({ statusCode: 404, statusMessage: 'Not Found', message: 'Not Found' })
    // the names the portable surface declares, which a handler branches on
    expect(error.status).toBe(404)
    expect(error.statusText).toBe('Not Found')
    expect(delegate.isNuxtError(error)).toBe(true)
  })

  it('recognises an error h3 v1 threw for itself, and exposes its status portably', () => {
    class H3Error extends Error {
      static __h3_error__ = true
      statusCode = 418
      statusMessage = 'Teapot'
    }
    const error: unknown = new H3Error('teapot')

    expect(delegate.isNuxtError(error)).toBe(true)
    if (delegate.isNuxtError(error)) {
      expect(error.status).toBe(418)
      expect(error.statusText).toBe('Teapot')
    }

    expect(delegate.isNuxtError(new Error('oops'))).toBe(false)
  })

  it('redirects with the same response and body as the shipped implementation', () => {
    const e = event('/')
    const body = delegate.sendRedirect(e, '/login?next="><script>alert(1)</script>')

    expect(e.node.res.statusCode).toBe(302)
    expect(e.node.res.getHeader('location')).toBe('/login?next="><script>alert(1)</script>')
    expect(body).toBe(shipped.sendRedirect(webEvent('https://nuxt.com/'), '/login?next="><script>alert(1)</script>'))
    expect(body).not.toContain('<script>')
  })

  describe('the event it hands a handler', () => {
    it('reads the request, its URL and the response in the portable shape', () => {
      const e = event('/api/hello?name=nuxt', { headers: { 'x-custom': 'value' } })
      const handler = delegate.defineEventHandler(portable => portable)

      const portable = handler(e)

      expect(portable.req).toBeInstanceOf(Request)
      expect(portable.req.headers.get('x-custom')).toBe('value')
      expect(portable.url.pathname).toBe('/api/hello')
      expect(portable.url.search).toBe('?name=nuxt')
      expect(portable.context).toBe(e.context)

      portable.res.status = 418
      portable.res.headers.set('x-from-portable', 'yes')
      expect(e.node.res.statusCode).toBe(418)
      expect(e.node.res.getHeader('x-from-portable')).toBe('yes')
    })

    it('is still the runtime event, so h3\'s own helpers work on it', () => {
      const e = event('/api/hello?name=nuxt')
      const handler = delegate.defineEventHandler(portable => portable)

      const portable = handler(e) as unknown as H3Event

      expect(portable.node).toBe(e.node)
      expect(portable.path).toBe('/api/hello?name=nuxt')
      expect(delegate.getQuery(portable)).toEqual({ name: 'nuxt' })
      delegate.setResponseStatus(portable, 204)
      expect(e.node.res.statusCode).toBe(204)
    })

    it('resolves through `toNuxtRequestEvent` to the h3 v1 event it is a view of', () => {
      const e = event('/api/hello?name=nuxt')
      const handler = delegate.defineEventHandler(portable => delegate.toNuxtRequestEvent(portable))

      expect(handler(e)).toBe(e)
    })

    it('is the same event every time, so state stored on it is shared', () => {
      const e = event('/')
      const handler = delegate.defineEventHandler(portable => portable)

      expect(handler(e)).toBe(handler(e))
    })
  })
})
