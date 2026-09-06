import { describe, expect, expectTypeOf, it } from 'vitest'
import type { RequestEventFallback } from 'nuxt/schema'

import {
  createError,
  defineEventHandler,
  deleteCookie,
  getCookie,
  getQuery,
  getRequestHeader,
  getRequestHeaders,
  getRequestURL,
  isNuxtError,
  readBody,
  sendRedirect,
  setCookie,
  setResponseHeader,
  setResponseHeaders,
  setResponseStatus,
} from '../src/server/index'
import type { NuxtErrorLike, RequestEvent } from '../src/server/index'

function event (request: Request): RequestEvent {
  return {
    req: request,
    url: new URL(request.url),
    res: { headers: new Headers() },
    context: {},
  } as unknown as RequestEvent
}

function response (event: RequestEvent) {
  return (event as unknown as RequestEventFallback).res
}

describe('`defineEventHandler`', () => {
  it('preserves the return type, which the generated route typings read', () => {
    const handler = defineEventHandler(() => ({ hello: 'world' }))
    expectTypeOf(handler).returns.toEqualTypeOf<{ hello: string }>()
  })

  it('contextually types the event it hands the handler', () => {
    defineEventHandler((event) => {
      expectTypeOf(event).toEqualTypeOf<RequestEvent>()
      return null
    })
  })
})

describe('request', () => {
  it('reads the request URL', () => {
    expect(getRequestURL(event(new Request('https://nuxt.com/api/hello?a=1'))).pathname).toBe('/api/hello')
  })

  it('reads a request header case-insensitively, or `undefined`', () => {
    const e = event(new Request('https://nuxt.com/', { headers: { 'X-Custom': 'value' } }))
    expect(getRequestHeader(e, 'x-custom')).toBe('value')
    expect(getRequestHeader(e, 'X-Custom')).toBe('value')
    expect(getRequestHeader(e, 'x-missing')).toBeUndefined()
  })

  it('reads every request header, keyed by lowercased name', () => {
    const e = event(new Request('https://nuxt.com/', { headers: { 'X-Custom': 'value' } }))
    expect(getRequestHeaders(e)).toMatchObject({ 'x-custom': 'value' })
  })

  it('parses the query, resolving a repeated parameter to an array', () => {
    const e = event(new Request('https://nuxt.com/?name=nuxt&tag=a&tag=b'))
    expect(getQuery(e)).toEqual({ name: 'nuxt', tag: ['a', 'b'] })
  })
})

describe('`readBody`', () => {
  function post (body: BodyInit, contentType?: string) {
    return event(new Request('https://nuxt.com/', {
      method: 'POST',
      body,
      headers: contentType ? { 'content-type': contentType } : undefined,
    }))
  }

  it.for([
    ['application/json'],
    ['application/json; charset=utf-8'],
    ['application/merge-patch+json'],
    ['application/problem+json; charset=utf-8'],
    // h3 parses an unrecognised type as JSON rather than sniffing it
    ['text/plain'],
    ['application/jsonp'],
    [undefined],
  ] as const)('parses a JSON body sent as %s', async ([contentType]) => {
    await expect(readBody(post(JSON.stringify({ name: 'nuxt' }), contentType))).resolves.toEqual({ name: 'nuxt' })
  })

  it('parses a URL-encoded body into its fields, collecting a repeated field', async () => {
    const body = 'name=nuxt&tag=a&tag=b'
    await expect(readBody(post(body, 'application/x-www-form-urlencoded'))).resolves.toEqual({ name: 'nuxt', tag: ['a', 'b'] })
    await expect(readBody(post(body, 'application/x-www-form-urlencoded; charset=utf-8'))).resolves.toEqual({ name: 'nuxt', tag: ['a', 'b'] })
  })

  it('reads an empty body as undefined', async () => {
    await expect(readBody(post('', 'application/json'))).resolves.toBeUndefined()
  })

  it('rejects a body that is not valid JSON with a 400', async () => {
    await expect(readBody(post('not json', 'text/plain'))).rejects.toMatchObject({ status: 400, statusText: 'Bad Request' })
  })
})

describe('response', () => {
  it('sets the status and reason phrase', () => {
    const e = event(new Request('https://nuxt.com/'))
    setResponseStatus(e, 201)
    expect(response(e).status).toBe(201)
    expect(response(e).statusText).toBeUndefined()

    setResponseStatus(e, 418, 'Teapot')
    expect(response(e)).toMatchObject({ status: 418, statusText: 'Teapot' })
  })

  it('replaces a header already set', () => {
    const e = event(new Request('https://nuxt.com/'))
    setResponseHeader(e, 'x-custom', 'first')
    setResponseHeader(e, 'x-custom', 'second')
    setResponseHeaders(e, { 'x-other': 'value' })
    expect(response(e).headers.get('x-custom')).toBe('second')
    expect(response(e).headers.get('x-other')).toBe('value')
  })
})

describe('cookies', () => {
  it('reads a cookie sent with the request, or `undefined`', () => {
    const e = event(new Request('https://nuxt.com/', { headers: { cookie: 'a=1; b=2' } }))
    expect(getCookie(e, 'b')).toBe('2')
    expect(getCookie(e, 'c')).toBeUndefined()
  })

  it('reads no cookie from a request that sent none', () => {
    expect(getCookie(event(new Request('https://nuxt.com/')), 'a')).toBeUndefined()
  })

  it('sets several cookies on one response', () => {
    const e = event(new Request('https://nuxt.com/'))
    setCookie(e, 'a', '1')
    setCookie(e, 'b', '2', { httpOnly: true })
    expect(response(e).headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/; HttpOnly'])
  })

  it('expires a cookie for the path and domain it was set with', () => {
    const e = event(new Request('https://nuxt.com/'))
    deleteCookie(e, 'a', { path: '/admin' })
    expect(response(e).headers.getSetCookie()).toEqual(['a=; Max-Age=0; Path=/admin'])
  })
})

describe('`sendRedirect`', () => {
  it('sets the status and location, and returns a body that follows it', () => {
    const e = event(new Request('https://nuxt.com/'))
    expect(sendRedirect(e, '/login')).toContain('url=/login')
    expect(response(e).status).toBe(302)
    expect(response(e).headers.get('location')).toBe('/login')

    sendRedirect(e, '/login', 301)
    expect(response(e).status).toBe(301)
  })

  it('encodes a location that would otherwise break out of the meta tag', () => {
    const e = event(new Request('https://nuxt.com/'))
    const body = sendRedirect(e, '/login?next="><script>alert(1)</script>')
    expect(body).not.toContain('<script>')
    expect(response(e).headers.get('location')).toBe('/login?next="><script>alert(1)</script>')
  })
})

describe('errors', () => {
  it('constructs an error the server runtime recognises by name', () => {
    const error = createError({ status: 404, statusText: 'Not Found' })
    expect(error.name).toBe('HTTPError')
    expect(error).toMatchObject({ status: 404, statusText: 'Not Found' })
  })

  it('recognises its own error', () => {
    expect(isNuxtError(createError('oops'))).toBe(true)
  })

  it('recognises an error thrown by the server runtime, which carries no Nuxt signature', () => {
    class HTTPError extends Error {
      override get name () { return 'HTTPError' }
      status = 418
    }
    expect(isNuxtError(new HTTPError('teapot'))).toBe(true)
  })

  it('rejects anything that is not an HTTP error', () => {
    expect(isNuxtError(new Error('oops'))).toBe(false)
    expect(isNuxtError({ status: 404 })).toBe(false)
    expect(isNuxtError(undefined)).toBe(false)
    expect(isNuxtError('oops')).toBe(false)
  })

  it('narrows to the shape both its own and the runtime\'s errors have', () => {
    const error: unknown = createError('oops')
    if (isNuxtError<{ id: string }>(error)) {
      expectTypeOf(error).toExtend<NuxtErrorLike<{ id: string }>>()
      expectTypeOf(error.status).toEqualTypeOf<number>()
      expectTypeOf(error.data).toEqualTypeOf<{ id: string } | undefined>()
    }
  })
})

describe('the event the surface is typed against', () => {
  it('is the event the configured server builder contributes, never a particular runtime\'s', () => {
    expectTypeOf<Parameters<typeof getRequestURL>[0]>().toEqualTypeOf<RequestEvent>()
    expectTypeOf<Parameters<typeof getCookie>[0]>().toEqualTypeOf<RequestEvent>()
    expectTypeOf<Parameters<typeof readBody>[0]>().toEqualTypeOf<RequestEvent>()
  })
})
