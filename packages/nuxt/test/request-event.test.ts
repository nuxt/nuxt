import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEvent } from 'h3'
import type { H3Event } from 'h3'
import type { RequestEvent } from 'nuxt/schema'

const nuxtApp: { ssrContext?: { event: unknown } } = {}

vi.mock('../src/app/nuxt', () => ({ useNuxtApp: () => nuxtApp }))

// eslint-disable-next-line @typescript-eslint/no-deprecated
const { setResponseStatus, useRequestHeader, useRequestHeaders, useResponseHeader } = await import('../src/app/composables/ssr')
const { useRequestURL } = await import('../src/app/composables/url')

const requestHeaders = {
  'cookie': 'a=1',
  'host': 'example.com',
  'x-custom': 'value',
  'x-forwarded-host': 'proxy.example',
  'x-forwarded-proto': 'https',
}

interface Shape {
  create: () => unknown
  status: (event: any) => { status?: number, statusText?: string }
  setCookies: (event: any) => string[]
  defaultURL: string
}

const shapes: Record<string, Shape> = {
  'an h3 event': {
    create: () => {
      const req = new IncomingMessage(new Socket())
      req.url = '/page?q=1'
      req.headers = { ...requestHeaders }
      return createEvent(req, new ServerResponse(req))
    },
    status: (event: H3Event) => ({ status: event.node.res.statusCode, statusText: event.node.res.statusMessage }),
    setCookies: (event: H3Event) => event.node.res.getHeader('set-cookie') as string[],
    defaultURL: 'https://example.com/page?q=1',
  },
  'a web-standard event': {
    create: (): RequestEvent => ({
      req: new Request('http://example.com/page?q=1', { headers: requestHeaders }),
      url: new URL('http://example.com/page?q=1'),
      res: { headers: new Headers() },
      context: {},
    }),
    status: (event: RequestEvent) => ({ status: event.res.status, statusText: event.res.statusText }),
    setCookies: (event: RequestEvent) => event.res.headers.getSetCookie(),
    defaultURL: 'http://example.com/page?q=1',
  },
}

describe.each(Object.entries(shapes))('request event composables on %s', (_, shape) => {
  let event: unknown

  beforeEach(() => {
    vi.stubGlobal('__TEST_SERVER__', true)
    event = shape.create()
    nuxtApp.ssrContext = { event }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete nuxtApp.ssrContext
  })

  it('should read a single request header', () => {
    expect(useRequestHeader('X-Custom')).toBe('value')
    expect(useRequestHeader('x-missing')).toBeUndefined()
  })

  it('should read every request header', () => {
    expect(useRequestHeaders()).toEqual(requestHeaders)
  })

  it('should read the request headers it is given', () => {
    expect(useRequestHeaders(['Cookie', 'x-missing'])).toEqual({ cookie: 'a=1' })
  })

  it('should read the request URL without forwarded options', () => {
    expect(useRequestURL().href).toBe(shape.defaultURL)
  })

  it.each([
    [{ xForwardedProto: false }, 'http://example.com/page?q=1'],
    [{ xForwardedProto: true }, 'https://example.com/page?q=1'],
    [{ xForwardedHost: true, xForwardedProto: false }, 'http://proxy.example/page?q=1'],
    [{ xForwardedHost: true, xForwardedProto: true }, 'https://proxy.example/page?q=1'],
  ])('should read the request URL with %j', (opts, expected) => {
    expect(useRequestURL(opts).href).toBe(expected)
  })

  it('should set the response status on the event it is given', () => {
    setResponseStatus(event as any, 418, 'Teapot')
    expect(shape.status(event)).toEqual({ status: 418, statusText: 'Teapot' })
  })

  it('should set the response status on the current event', () => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    setResponseStatus(404, 'Missing')
    expect(shape.status(event)).toEqual({ status: 404, statusText: 'Missing' })
  })

  it('should read and write a response header', () => {
    const header = useResponseHeader('x-out')
    expect(header.value).toBeUndefined()
    header.value = 'set'
    expect(useResponseHeader('X-Out').value).toBe('set')
    header.value = undefined
    expect(useResponseHeader('x-out').value).toBeUndefined()
  })

  it('should write a response header with several values', () => {
    useResponseHeader('set-cookie').value = ['a=1', 'b=2']
    expect(shape.setCookies(event)).toEqual(['a=1', 'b=2'])
  })
})

describe('forwarded hosts on a web-standard event', () => {
  beforeEach(() => {
    vi.stubGlobal('__TEST_SERVER__', true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete nuxtApp.ssrContext
  })

  it.each([
    ['proxy.example', 'http://proxy.example/page'],
    ['proxy.example:8443', 'http://proxy.example:8443/page'],
    ['[::1]:8443', 'http://[::1]:8443/page'],
    ['proxy.example:99999', 'http://proxy.example/page'],
    ['bad host:8443', 'http://example.com:3000/page'],
  ])('should resolve %s', (host, expected) => {
    const event = shapes['a web-standard event']!.create() as RequestEvent
    event.url = new URL('http://example.com:3000/page')
    event.req.headers.set('x-forwarded-host', host)
    nuxtApp.ssrContext = { event }
    expect(useRequestURL({ xForwardedHost: true }).href).toBe(expected)
  })

  it.each([
    ['http, https', 'http://example.com/page'],
    ['wss', 'https://example.com/page'],
  ])('should resolve a forwarded protocol of %s', (proto, expected) => {
    const event = shapes['a web-standard event']!.create() as RequestEvent
    event.url = new URL('https://example.com/page')
    event.req.headers.set('x-forwarded-proto', proto)
    nuxtApp.ssrContext = { event }
    expect(useRequestURL({ xForwardedProto: true }).href).toBe(expected)
  })
})
