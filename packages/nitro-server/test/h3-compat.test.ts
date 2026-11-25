// the v1 helpers under test are deprecated in h3 v2 by definition
/* eslint-disable @typescript-eslint/no-deprecated */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dirname, resolve } from 'pathe'
import { parseSync } from 'rolldown/utils'
import { H3, HTTPError, mockEvent } from 'nitro/h3'

import {
  createError,
  defineEventHandler,
  eventHandler,
  getCookie,
  getHeader,
  getQuery,
  getRequestWebStream,
  getRouterParam,
  handleCacheHeaders,
  handleCors,
  lazyEventHandler,
  proxyRequest,
  readBody,
  readFormData,
  readRawBody,
  readValidatedBody,
  send,
  sendError,
  sendIterable,
  sendNoContent,
  sendProxy,
  sendRedirect,
  sendStream,
  sendWebResponse,
  setCookie,
  setResponseStatus,
  splitCookiesString,
  toLegacyError,
  toWebRequest,
} from '../src/runtime/compat/h3-v1.ts'
import * as serverShim from '../src/runtime/compat/h3-v1.ts'
import * as appShim from '../src/runtime/compat/h3-v1-app.ts'
import { prepareLegacyEvent } from '../src/runtime/compat/event.ts'
import { wrapLegacyHandler } from '../src/runtime/compat/legacy-handler.ts'

describe('h3 v1 shim', () => {
  it('reads the request through v1 helpers', async () => {
    const event = mockEvent('http://nuxt/api/test?foo=bar', {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'content-type': 'application/json', 'cookie': 'session=abc', 'x-custom': 'yes' },
    })
    event.context.params = { id: '42' }

    expect(getQuery(event)).toEqual({ foo: 'bar' })
    expect(await readBody(event)).toEqual({ hello: 'world' })
    expect(getHeader(event, 'x-custom')).toBe('yes')
    expect(getCookie(event, 'session')).toBe('abc')
    expect(getRouterParam(event, 'id')).toBe('42')
  })

  it('writes the response through v1 helpers', () => {
    const event = mockEvent('http://nuxt/api/test')

    setResponseStatus(event, 201, 'Created')
    setCookie(event, 'session', 'abc')

    expect(event.res.status).toBe(201)
    expect(event.res.statusText).toBe('Created')
    expect(event.res.headers.get('set-cookie')).toContain('session=abc')
    expect(send(event, 'body', 'text/plain')).toBe('body')
    expect(event.res.headers.get('content-type')).toBe('text/plain')
  })

  it('creates errors carrying both v1 and v2 keys', () => {
    const error = createError({ statusCode: 418, statusMessage: 'I am a teapot', data: { cup: true }, fatal: true })

    expect(error.statusCode).toBe(418)
    expect(error.statusMessage).toBe('I am a teapot')
    expect(error.status).toBe(418)
    expect(error.data).toEqual({ cup: true })
    expect((error as { fatal?: boolean }).fatal).toBe(true)
    expect(error.toJSON()).toMatchObject({
      status: 418,
      statusCode: 418,
      statusMessage: 'I am a teapot',
      data: { cup: true },
    })
  })

  it('creates errors whose v1 fields can be assigned', () => {
    const error: any = createError({ statusCode: 404, statusMessage: 'Not Found', data: { page: 1 }, fatal: true })
    const cause = new Error('inner')

    error.fatal = false
    error.unhandled = true
    error.statusCode = 410
    error.statusMessage = 'Gone'
    error.data = { page: 2 }
    error.cause = cause

    expect(error).toMatchObject({ fatal: false, unhandled: true, status: 410, statusText: 'Gone', statusCode: 410, statusMessage: 'Gone', data: { page: 2 }, cause })
    expect(error.toJSON()).toMatchObject({ status: 410, statusCode: 410, statusMessage: 'Gone' })
    expect(Object.keys(error)).not.toContain('fatal')
    expect(Object.keys(error)).not.toContain('statusCode')
  })

  it('keeps the cause an error is created with', () => {
    const cause = new Error('inner')

    expect(createError({ statusCode: 500, message: 'outer', cause }).cause).toBe(cause)
    expect(createError({ status: 500, message: 'outer', cause }).cause).toBe(cause)

    const input = { statusCode: 500, message: 'outer' }
    expect(createError(input).cause).toBe(input)

    expect(createError(null as any).status).toBe(500)
  })

  it('keeps the status of an unhandled error created with an h3 v1 cause', () => {
    class ForeignH3Error extends Error {
      static __h3_error__ = true
      statusCode = 404
      unhandled = false
      data = { secret: 'inner' }
    }

    const error = toLegacyError(createError({ statusCode: 503, unhandled: true, cause: new ForeignH3Error('inner') }))

    expect(error.status).toBe(503)
    expect(error.unhandled).toBe(true)
    expect(JSON.stringify(error.toJSON())).not.toContain('inner')
  })

  it('leaves v3-shaped input untouched', () => {
    const v3 = createError({ status: 418, statusText: 'I am a teapot' })
    expect(v3.toJSON()).not.toHaveProperty('statusCode')
    expect(v3.status).toBe(418)

    const existing = createError({ statusCode: 404 })
    expect(createError(existing)).toBe(existing)
    expect(toLegacyError(existing)).toBe(existing)
  })

  it('does not treat a parsed upstream payload as an h3 v1 error', () => {
    // `throw await res.json()` is a widespread pattern: `{ statusCode, message, data }`
    // must not be able to pick this app's status, so `data` is not a v1 marker
    const upstream = toLegacyError(new HTTPError({ status: 500, unhandled: true, cause: { statusCode: 403, message: 'Nope', data: { secret: 'upstream' } } }))
    expect(upstream.status).toBe(500)
    expect(upstream.toJSON()).not.toHaveProperty('data.secret')
  })

  it('normalises an h3 v1 error from a copy of h3 the app does not run', () => {
    // an h3 v1 error bundled into a module's own output: not an `HTTPError`, so
    // h3 would treat the 404 it carries as an unhandled 500
    class ForeignH3Error extends Error {
      static __h3_error__ = true
      statusCode = 404
      statusMessage = 'Not Found'
      data = { from: 'bundled-h3' }
    }

    const normalised = toLegacyError(new ForeignH3Error('nope'))
    expect(normalised.status).toBe(404)
    expect(normalised.statusText).toBe('Not Found')
    expect(normalised.toJSON()).toMatchObject({ statusCode: 404, data: { from: 'bundled-h3' } })
  })

  it('keeps the status of a foreign error carrying one, without its message or data', () => {
    // an ofetch `FetchError` names the URL it called in its message, and carries the
    // upstream response body as `data`. h3 v1 marked it unhandled, so nitro v2 answered
    // with its status and 'Server Error'
    const upstream = Object.defineProperties(new Error('[GET] "http://10.0.0.7/internal": 500 Internal Server Error'), {
      status: { get: () => 500 },
      statusCode: { get: () => 500 },
      statusText: { get: () => 'Internal Server Error' },
      statusMessage: { get: () => 'Internal Server Error' },
      data: { get: () => ({ secret: 'upstream' }) },
    })

    const normalised = toLegacyError(upstream)

    expect(normalised.status).toBe(500)
    expect(normalised.statusText).toBe('Internal Server Error')
    const body = JSON.stringify(normalised.toJSON())
    expect(body).not.toContain('10.0.0.7')
    expect(body).not.toContain('upstream')
    // kept on the error itself, for the server-side log and the `error` hook
    expect((normalised.cause as Error).message).toContain('10.0.0.7')
  })

  it('leaves a thrown error carrying no status unhandled, so it is not serialised to the client', () => {
    const error = toLegacyError(new Error('postgres://user:pw@db'))

    expect(error.status).toBe(500)
    expect(error.unhandled).toBe(true)
    expect(JSON.stringify(error.toJSON())).not.toContain('postgres://')
    // kept on the error itself, for the server-side log
    expect(error.message).toContain('postgres://')
    expect(error.stack).toContain('postgres://')
  })

  it('leaves a thrown object carrying no status unhandled too', () => {
    const error = toLegacyError({ message: 'internal', data: { secret: 's3cret' } })

    expect(error.unhandled).toBe(true)
    expect(JSON.stringify(error.toJSON())).not.toContain('s3cret')
  })

  it('normalises thrown values into v1-shaped errors', () => {
    expect(toLegacyError({ statusCode: 400 }).status).toBe(400)
    expect(toLegacyError(new Error('boom')).status).toBe(500)
    expect(toLegacyError({ status: 503 }).status).toBe(503)
    expect(toLegacyError('boom').message).toBe('boom')
    expect(toLegacyError({ statusCode: 400, message: 'internal detail' }).toJSON()).not.toMatchObject({ message: 'internal detail' })
    const error = createError({ statusCode: 404 })
    expect(toLegacyError(error)).toBe(error)
  })

  it('serialises errors from `sendError`', () => {
    const event = mockEvent('http://nuxt/api/test')
    const body = sendError(event, createError({ statusCode: 404, statusMessage: 'Not Found' }))

    expect(event.res.status).toBe(404)
    expect(event.res.headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(body)).toMatchObject({ statusCode: 404, statusMessage: 'Not Found' })
  })

  it('redirects', async () => {
    const event = mockEvent('http://nuxt/api/test')
    await sendRedirect(event, '/login', 302)

    expect(event.res.status).toBe(302)
    expect(event.res.headers.get('location')).toBe('/login')
  })

  it('splits combined `set-cookie` header values', () => {
    expect(splitCookiesString('a=1; Path=/, b=2; Path=/')).toEqual(['a=1; Path=/', 'b=2; Path=/'])
  })

  it('supports the v1 object handler form', async () => {
    const calls: string[] = []
    const handler = defineEventHandler({
      onRequest: [() => { calls.push('onRequest') }],
      onBeforeResponse: [(_event, response) => { calls.push(`onBeforeResponse:${response.body}`) }],
      handler: () => 'ok',
    })

    const response = await handler.fetch(new Request('http://nuxt/api/test'))

    expect(await response.text()).toBe('ok')
    expect(calls).toEqual(['onRequest', 'onBeforeResponse:ok'])
  })

  it('responds to a WebSocket upgrade request with the `websocket` hooks of the v1 object form', async () => {
    const websocket = { open: () => {} }
    const handler = defineEventHandler({ websocket, handler: () => 'http' })
    const upgradeEvent = () => mockEvent('http://nuxt/_ws', { headers: { connection: 'Upgrade', upgrade: 'websocket' } })

    for (const entry of [handler, eventHandler({ websocket, handler: () => 'http' }), lazyEventHandler(() => handler)]) {
      const response = await (entry as (event: unknown) => Promise<Response & { crossws?: unknown }>)(upgradeEvent())
      expect(response.status).toBe(426)
      expect(response.crossws).toBe(websocket)
    }

    const http = await handler.fetch(new Request('http://nuxt/_ws'))
    expect(await http.text()).toBe('http')
  })

  it('sends a string a handler returns as HTML unless the handler sets a content type', async () => {
    const html = await defineEventHandler(() => '<h1>ok</h1>').fetch(new Request('http://nuxt/page'))
    expect(html.headers.get('content-type')).toBe('text/html')

    const text = await defineEventHandler((event) => {
      event.res.headers.set('content-type', 'text/plain')
      return 'ok'
    }).fetch(new Request('http://nuxt/robots.txt'))
    expect(text.headers.get('content-type')).toBe('text/plain')

    const json = await defineEventHandler(() => ({ ok: true })).fetch(new Request('http://nuxt/api/test'))
    expect(json.headers.get('content-type')).toContain('application/json')

    const notModified = await defineEventHandler((event) => {
      event.res.status = 304
      return ''
    }).fetch(new Request('http://nuxt/page'))
    expect(notModified.headers.has('content-type')).toBe(false)
  })

  it('answers a handler that returns `null` with no content', async () => {
    const empty = await defineEventHandler(() => null).fetch(new Request('http://nuxt/api/null'))
    expect(empty.status).toBe(204)
    expect(empty.headers.has('content-type')).toBe(false)
    expect(await empty.text()).toBe('')

    const accepted = await defineEventHandler((event) => {
      setResponseStatus(event, 202)
      return null
    }).fetch(new Request('http://nuxt/api/null'))
    expect(accepted.status).toBe(202)
    expect(accepted.headers.has('content-type')).toBe(false)
    expect(await accepted.text()).toBe('')

    const written = await defineEventHandler((event) => {
      event.node.res.statusCode = 201
      event.node.res.setHeader('x-written', '1')
      return null
    }).fetch(new Request('http://nuxt/api/null'))
    expect(written.status).toBe(201)
    expect(written.headers.get('x-written')).toBe('1')
  })

  it('passes on from a handler that returns `undefined`', async () => {
    const event = mockEvent('http://nuxt/api/test')
    expect(await (defineEventHandler(() => undefined) as (event: unknown) => unknown)(event)).toBeUndefined()
    expect(event.res.status).toBeUndefined()
  })

  it('normalises errors thrown from a handler', async () => {
    const handler = defineEventHandler(() => {
      throw createError({ statusCode: 422, statusMessage: 'Unprocessable', data: { field: 'name' } })
    })

    const response = await handler.fetch(new Request('http://nuxt/api/test'))

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ statusCode: 422, statusMessage: 'Unprocessable', data: { field: 'name' } })
  })

  it('answers a bare object thrown from a handler with its status alone', async () => {
    const handler = defineEventHandler(() => {
      throw { statusCode: 422, statusMessage: 'Unprocessable', data: { field: 'name' } }
    })

    const response = await handler.fetch(new Request('http://nuxt/api/test'))

    expect(response.status).toBe(422)
    const body = await response.text()
    expect(JSON.parse(body)).toMatchObject({ statusCode: 422, statusMessage: 'Unprocessable' })
    expect(body).not.toContain('field')
  })
})

describe('v1 helpers that end the response', () => {
  const corsOptions = { origin: ['https://app.example'], methods: ['GET', 'POST'] }
  const preflight = (path = '/api/item') => new Request(`http://nuxt${path}`, {
    method: 'OPTIONS',
    headers: { 'origin': 'https://app.example', 'access-control-request-method': 'POST' },
  })
  const cors = (event: any) => {
    if (handleCors(event, corsOptions)) {
      return
    }
  }

  function createApp (middleware: unknown) {
    const routes: string[] = []
    const app = new H3()
    app.use(middleware as any)
    app.post('/api/item', defineEventHandler(() => 'route'))
    app.all('/api/any', defineEventHandler(() => {
      routes.push('/api/any')
      return 'route'
    }))
    app.get('/api/target', () => 'proxied')
    return { app, routes }
  }

  it.each([
    ['a v1 middleware', defineEventHandler(cors)],
    ['a function middleware the layer wraps', wrapLegacyHandler(cors)],
  ])('responds to a preflight request handled by %s that returns nothing', async (_, middleware) => {
    const response = await createApp(middleware).app.fetch(preflight())

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET,POST')
  })

  it('skips a v1 handler after a function middleware that handled a preflight request', async () => {
    const { app, routes } = createApp(cors)
    const response = await app.fetch(preflight('/api/any'))

    expect(response.status).toBe(204)
    expect(routes).toEqual([])
  })

  it('skips a handler the layer wraps after a function middleware that handled a preflight request', async () => {
    const routes: string[] = []
    const app = new H3()
    app.use(cors as any)
    app.all('/api/any', wrapLegacyHandler(() => {
      routes.push('/api/any')
      return 'route'
    }) as any)

    const response = await app.fetch(preflight('/api/any'))

    expect(response.status).toBe(204)
    expect(routes).toEqual([])
  })

  it('skips the handler and later hooks after an `onRequest` hook that ended the response', async () => {
    const calls: string[] = []
    const handler = defineEventHandler({
      onRequest: [
        (event) => {
          calls.push('onRequest:1')
          sendRedirect(event, '/login')
        },
        () => { calls.push('onRequest:2') },
      ],
      onBeforeResponse: [() => { calls.push('onBeforeResponse') }],
      handler: () => {
        calls.push('handler')
        return 'ok'
      },
    })

    const response = await handler.fetch(new Request('http://nuxt/api/test', { redirect: 'manual' }))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/login')
    expect(calls).toEqual(['onRequest:1'])
  })

  it('responds to a preflight request handled by a route handler that returns nothing', async () => {
    const response = await defineEventHandler((event) => {
      if (handleCors(event, corsOptions)) {
        return
      }
      return 'route'
    }).fetch(preflight())

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
  })

  it('continues past `handleCors` for a request that is not a preflight', async () => {
    const event = mockEvent('http://nuxt/api/item', { method: 'POST', headers: { origin: 'https://app.example' } })
    expect(handleCors(event, corsOptions)).toBe(false)

    const response = await createApp(defineEventHandler(cors)).app.fetch(new Request('http://nuxt/api/item', { method: 'POST', headers: { origin: 'https://app.example' } }))
    expect(await response.text()).toBe('route')
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example')
  })

  it.each<[string, (event: any) => unknown, { status: number, body?: string, headers?: Record<string, string> }]>([
    ['sendRedirect', event => sendRedirect(event, '/login'), { status: 302, headers: { location: '/login' } }],
    ['sendNoContent', event => sendNoContent(event), { status: 204, body: '' }],
    ['sendNoContent after a status', (event) => {
      setResponseStatus(event, 202)
      sendNoContent(event)
    }, { status: 202, body: '' }],
    ['send', event => send(event, 'sent', 'text/plain'), { status: 200, body: 'sent', headers: { 'content-type': 'text/plain' } }],
    ['sendStream', event => sendStream(event, new Response('streamed').body), { status: 200, body: 'streamed' }],
    ['sendError', event => sendError(event, createError({ statusCode: 418, statusMessage: 'Teapot' })), { status: 418, headers: { 'content-type': 'application/json' } }],
    ['sendWebResponse', event => sendWebResponse(event, new Response('web', { status: 201 })), { status: 201, body: 'web' }],
    ['sendIterable', event => sendIterable(event, ['a', 'b']), { status: 200, body: 'ab' }],
    ['sendProxy', event => sendProxy(event, '/api/target'), { status: 200, body: 'proxied' }],
    ['proxyRequest', event => proxyRequest(event, '/api/target'), { status: 200, body: 'proxied' }],
  ])('responds with what `%s` sends from a middleware that returns nothing', async (_, helper, expected) => {
    const middleware = defineEventHandler(async (event) => {
      if (event.path === '/api/any') {
        await helper(event)
      }
    })
    const { app, routes } = createApp(middleware)
    const response = await app.fetch(new Request('http://nuxt/api/any', { redirect: 'manual' }))

    expect(routes).toEqual([])
    expect(response.status).toBe(expected.status)
    if (expected.body !== undefined) {
      expect(await response.text()).toBe(expected.body)
    }
    for (const [name, value] of Object.entries(expected.headers || {})) {
      expect(response.headers.get(name)).toBe(value)
    }
  })

  it('responds with `304 Not Modified` from `handleCacheHeaders` in a middleware that returns nothing', async () => {
    const middleware = defineEventHandler((event) => {
      if (handleCacheHeaders(event, { etag: '"v1"' })) {
        return
      }
    })
    const { app, routes } = createApp(middleware)
    const response = await app.fetch(new Request('http://nuxt/api/any', { headers: { 'if-none-match': '"v1"' } }))

    expect(response.status).toBe(304)
    expect(routes).toEqual([])

    const miss = await app.fetch(new Request('http://nuxt/api/any'))
    expect(await miss.text()).toBe('route')
    expect(miss.headers.get('etag')).toBe('"v1"')
  })
})

describe('v1 body readers', () => {
  const jsonEvent = () => mockEvent('http://nuxt/api/test', {
    method: 'POST',
    body: JSON.stringify({ a: 1 }),
    headers: { 'content-type': 'application/json' },
  })

  it('leaves the request readable for a later reader', async () => {
    const event = jsonEvent()

    expect(await readBody(event)).toEqual({ a: 1 })
    expect(event.req.bodyUsed).toBe(false)
    expect(await event.req.text()).toBe(JSON.stringify({ a: 1 }))
  })

  it('reads the body once for repeated v1 reads', async () => {
    const event = jsonEvent()
    let clones = 0
    const clone = event.req.clone.bind(event.req)
    event.req.clone = () => {
      clones++
      return clone()
    }

    expect(await readBody(event)).toEqual({ a: 1 })
    expect(await readBody(event)).toEqual({ a: 1 })
    expect(await readRawBody(event)).toBe(JSON.stringify({ a: 1 }))
    expect(clones).toBe(1)
    expect(event.req.bodyUsed).toBe(false)
  })

  it('replays the body for form, validated and stream readers', async () => {
    const form = mockEvent('http://nuxt/api/test', {
      method: 'POST',
      body: 'name=nuxt',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })

    expect(Object.fromEntries((await readFormData(form)).entries())).toEqual({ name: 'nuxt' })
    expect(await readBody(form)).toEqual({ name: 'nuxt' })
    expect(form.req.bodyUsed).toBe(false)

    const event = jsonEvent()
    expect(await readValidatedBody(event, data => data as { a: number })).toEqual({ a: 1 })
    const stream = getRequestWebStream(event)!
    expect(new TextDecoder().decode((await stream.getReader().read()).value)).toBe(JSON.stringify({ a: 1 }))
    expect(event.req.bodyUsed).toBe(false)
  })

  it('copies the request with `toWebRequest`, leaving the body readable', async () => {
    const event = mockEvent('http://nuxt/api/test?foo=bar', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
    })

    const request = toWebRequest(event)
    expect(request.url).toBe('http://nuxt/api/test?foo=bar')
    expect(request.method).toBe('POST')
    expect(request.headers.get('content-type')).toBe('application/json')
    expect(await request.json()).toEqual({ a: 1 })
    expect(await readBody(event)).toEqual({ a: 1 })

    const get = toWebRequest(mockEvent('http://nuxt/api/test'))
    expect(get.method).toBe('GET')
    expect(get.body).toBeNull()
  })

  const bodyEvent = (body: string, contentType: string) => mockEvent('http://nuxt/body', {
    method: 'POST',
    body,
    headers: { 'content-type': contentType },
  })

  it('returns a text body as text', async () => {
    expect(await readBody(bodyEvent('hello', 'text/plain'))).toBe('hello')
    expect(await readBody(bodyEvent('{"a":1}', 'text/plain; charset=utf-8'))).toBe('{"a":1}')
  })

  it('parses a body of another content type as JSON, falling back to the text', async () => {
    expect(await readBody(bodyEvent('hello', 'application/octet-stream'))).toBe('hello')
    expect(await readBody(bodyEvent('{"a":1}', 'application/octet-stream'))).toEqual({ a: 1 })
    expect(await readBody(bodyEvent('{"a":1}', 'application/json; charset=utf-8'))).toEqual({ a: 1 })
    expect(await readBody(bodyEvent('hello', 'application/json; charset=utf-8'))).toBe('hello')
  })

  it('parses an `application/json` body strictly unless told otherwise', async () => {
    await expect(readBody(bodyEvent('hello', 'application/json'))).rejects.toMatchObject({ statusCode: 400, message: 'Invalid JSON body' })
    expect(await readBody(bodyEvent('hello', 'application/json'), { strict: false })).toBe('hello')
    await expect(readBody(bodyEvent('hello', 'application/octet-stream'), { strict: true })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('matches the content type case-insensitively', async () => {
    expect(await readBody(bodyEvent('name=nuxt', 'Application/X-WWW-Form-Urlencoded'))).toEqual({ name: 'nuxt' })
    expect(await readBody(bodyEvent('{"a":1}', 'Text/Plain'))).toBe('{"a":1}')
    await expect(readBody(bodyEvent('hello', 'Application/JSON'))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('validates the body as `readBody` reads it, parsing strictly', async () => {
    const identity = (data: unknown) => data

    expect(await readValidatedBody(bodyEvent('hello', 'text/plain'), identity)).toBe('hello')
    expect(await readValidatedBody(bodyEvent('{"a":1}', 'text/plain'), identity)).toBe('{"a":1}')
    expect(await readValidatedBody(bodyEvent('{"a":1}', 'text/plain'), identity, { type: 'json' })).toEqual({ a: 1 })
    expect(await readValidatedBody(bodyEvent('name=nuxt', 'application/x-www-form-urlencoded'), identity)).toEqual({ name: 'nuxt' })
    expect(await readValidatedBody(bodyEvent('{"a":1}', 'application/octet-stream'), identity)).toEqual({ a: 1 })
    expect(await readValidatedBody(mockEvent('http://nuxt/body', { method: 'POST' }), identity)).toBeUndefined()
    await expect(readValidatedBody(bodyEvent('hello', 'application/octet-stream'), identity)).rejects.toMatchObject({ status: 400, message: 'Invalid JSON body' })
    await expect(readValidatedBody(bodyEvent('hello', 'text/plain'), () => false)).rejects.toMatchObject({ status: 400 })
  })

  it('returns the same text body for repeated reads', async () => {
    const event = bodyEvent('hello', 'text/plain')

    expect(await readBody(event)).toBe('hello')
    expect(await readBody(event)).toBe('hello')
    expect(await readRawBody(event)).toBe('hello')
    expect(event.req.bodyUsed).toBe(false)
  })

  it('rejects every read of a body whose source fails', async () => {
    const request = new Request('http://nuxt/', {
      method: 'POST',
      duplex: 'half',
      body: new ReadableStream({ start (controller) { controller.error(new Error('body source failed')) } }),
    } as RequestInit)
    const event = mockEvent(request)

    await expect(readRawBody(event)).rejects.toThrow('body source failed')
    await expect(readRawBody(event)).rejects.toThrow('body source failed')
    await expect(readBody(event)).rejects.toThrow('body source failed')
  })

  it('rejects a read of a body already consumed elsewhere', async () => {
    const event = bodyEvent('hello', 'text/plain')
    await event.req.text()

    await expect(readRawBody(event)).rejects.toThrow(TypeError)
    await expect(readBody(event)).rejects.toThrow(TypeError)
  })

  it('returns `undefined` for a request with no body', async () => {
    const event = mockEvent('http://nuxt/api/test', { method: 'POST' })

    expect(await readRawBody(event)).toBeUndefined()
    expect(getRequestWebStream(event)).toBeUndefined()
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('rejects a read of a %s request with `405`, as h3 v1 did', async (method) => {
    const event = mockEvent('http://nuxt/api/test', { method })
    const notAllowed = { statusCode: 405, statusMessage: 'HTTP method is not allowed.' }

    await expect(readBody(event)).rejects.toMatchObject(notAllowed)
    await expect(readBody(event, { type: 'text' })).rejects.toMatchObject(notAllowed)
    await expect(readRawBody(event)).rejects.toMatchObject(notAllowed)
    await expect(readValidatedBody(event, data => data)).rejects.toMatchObject(notAllowed)
    await expect(readValidatedBody(event, data => data, { type: 'text' })).rejects.toMatchObject(notAllowed)

    const response = await defineEventHandler(async (event) => {
      const { name } = await readBody(event)
      return { name }
    }).fetch(new Request('http://nuxt/api/test', { method }))
    expect(response.status).toBe(405)
  })

  it('returns the first parsed body to every later read, whatever its strictness', async () => {
    const event = bodyEvent('hello', 'application/octet-stream')

    expect(await readBody(event)).toBe('hello')
    expect(await readBody(event, { strict: true })).toBe('hello')
  })

  it('hands a later reader the body an earlier reader changed', async () => {
    const event = jsonEvent()
    const body = await readBody(event)
    body.touched = true

    expect(await readBody(event, { strict: true })).toBe(body)
  })

  it('parses the body again after a strict read fails', async () => {
    const event = bodyEvent('hello', 'application/octet-stream')

    await expect(readBody(event, { strict: true })).rejects.toMatchObject({ status: 400 })
    expect(await readBody(event)).toBe('hello')
  })
})

describe('v1 event bridge', () => {
  it('provides `event.context.nitro` and a node response bridge', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test?a=1'))

    expect((event.context as Record<string, any>).nitro).toEqual({ errors: [] })
    expect(event.node!.req.url).toBe('/api/test?a=1')
    expect(event.node!.req.method).toBe('GET')

    const res = event.node!.res as any
    res.statusCode = 404
    res.setHeader('x-test', 'yes')
    res.writeHead(500, { 'x-other': 'yes' })

    expect(event.res.status).toBe(500)
    expect(res.getHeader('x-test')).toBe('yes')
    expect(event.res.headers.get('x-other')).toBe('yes')
    expect(res.getHeaders()).toMatchObject({ 'x-test': 'yes' })

    res.removeHeader('x-test')
    expect(res.hasHeader('x-test')).toBe(false)
  })

  it('keeps every value a node handler sets a header to', () => {
    const event = prepareLegacyEvent(mockEvent('http://nuxt/api/test'))
    const res = event.node!.res as any

    res.setHeader('link', ['</a>; rel=preload', '</b>; rel=preload'])
    res.setHeader('set-cookie', ['a=1', 'b=2'])

    expect(event.res.headers.get('link')).toBe('</a>; rel=preload, </b>; rel=preload')
    expect(event.res.headers.getSetCookie()).toEqual(['a=1', 'b=2'])

    // and replaces, rather than appends, when set again
    res.setHeader('link', '</c>; rel=preload')
    expect(event.res.headers.get('link')).toBe('</c>; rel=preload')
  })
})

describe('h3 v1 app shim', () => {
  it('provides the helpers of the server shim, without its handler wrapper', () => {
    const wrapper = ['defineEventHandler', 'eventHandler']
    expect(Object.keys(appShim).sort()).toEqual(Object.keys(serverShim).sort())
    for (const name of Object.keys(serverShim)) {
      if (wrapper.includes(name)) {
        expect(appShim[name as keyof typeof appShim]).not.toBe(serverShim[name as keyof typeof serverShim])
      } else {
        expect(appShim[name as keyof typeof appShim]).toBe(serverShim[name as keyof typeof serverShim])
      }
    }
  })

  it('imports nothing that loads the Nitro runtime', () => {
    const appShimPath = fileURLToPath(new URL('../src/runtime/compat/h3-v1-app.ts', import.meta.url))
    const serverShimPath = fileURLToPath(new URL('../src/runtime/compat/h3-v1.ts', import.meta.url))
    expect([...collectBareImports(serverShimPath)]).toEqual(expect.arrayContaining(['nitro/app', 'nitro/context']))

    const imports = [...collectBareImports(appShimPath)]
    expect(imports.filter(specifier => /^(?:#|nitro(?:\/|$))/.test(specifier) && specifier !== 'nitro/h3')).toEqual([])
  })
})

/** The non-relative specifiers a module and the relative modules it imports load at runtime. */
function collectBareImports (entry: string): Set<string> {
  const found = new Set<string>()
  const seen = new Set<string>()
  const pending = [entry]
  while (pending.length > 0) {
    const file = pending.pop()!
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    const code = readFileSync(file, 'utf8')
    const { module } = parseSync(file, code, { lang: 'ts', sourceType: 'module' })
    const requests = [
      ...module.staticImports.filter(entry => entry.entries.length === 0 || entry.entries.some(e => !e.isType)).map(entry => entry.moduleRequest.value),
      ...module.staticExports.flatMap(entry => entry.entries.filter(e => e.moduleRequest && !e.isType).map(e => e.moduleRequest!.value)),
      ...module.dynamicImports.map(entry => code.slice(entry.moduleRequest.start, entry.moduleRequest.end).replace(/^(['"`])(.*)\1$/s, '$2')),
    ]
    for (const request of requests) {
      if (request.startsWith('.')) {
        pending.push(resolve(dirname(file), request))
      } else {
        found.add(request)
      }
    }
  }
  return found
}
