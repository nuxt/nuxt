// the v1 helpers under test are deprecated in h3 v2 by definition
/* eslint-disable @typescript-eslint/no-deprecated */
import { describe, expect, it } from 'vitest'
import { HTTPError, mockEvent } from 'nitro/h3'

import {
  createError,
  defineEventHandler,
  getCookie,
  getHeader,
  getQuery,
  getRequestWebStream,
  getRouterParam,
  readBody,
  readFormData,
  readRawBody,
  readValidatedBody,
  send,
  sendError,
  sendRedirect,
  setCookie,
  setResponseStatus,
  splitCookiesString,
  toLegacyError,
} from '../src/runtime/compat/h3-v1.ts'
import { prepareLegacyEvent } from '../src/runtime/compat/event.ts'

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

  it('returns `undefined` for a request with no body', async () => {
    const event = mockEvent('http://nuxt/api/test')

    expect(await readRawBody(event)).toBeUndefined()
    expect(getRequestWebStream(event)).toBeUndefined()
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
