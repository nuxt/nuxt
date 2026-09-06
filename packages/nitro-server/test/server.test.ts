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
    } as unknown as RequestEvent
  }

  function event (path: string, options: { method?: string, headers?: Record<string, string> } = {}): H3Event {
    const headers: Record<string, string | string[] | undefined> = {}
    const req = { method: options.method || 'GET', url: path, headers: { host: 'nuxt.com', ...options.headers } }
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
})
