import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { H3, readBody, serve } from 'nitro/h3'
import { defineEventHandler, toNuxtRequestEvent } from '../src/runtime/server.ts'
import { readBody as readLegacyBody } from '../src/runtime/compat/h3-v1.ts'

function withTimeout<T> (promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} did not settle`)), 1000)),
  ])
}

const app = new H3()

app.post('/web-then-h3', defineEventHandler(async (event) => {
  const web = await event.req.json()
  return { web, h3: await withTimeout(readBody(event), 'readBody') }
}))

app.post('/h3-then-web', defineEventHandler(async (event) => {
  const h3 = await readBody(event)
  return { h3, web: await withTimeout(event.req.json(), 'req.json') }
}))

app.post('/web-then-web', defineEventHandler(async (event) => {
  const first = await event.req.text()
  return { first, second: await withTimeout(event.req.text(), 'second read') }
}))

app.post('/clone', defineEventHandler(async (event) => {
  const clone = await withTimeout(event.req.clone().text(), 'clone')
  return { clone, original: await withTimeout(event.req.text(), 'original') }
}))

app.post('/formdata-then-web', defineEventHandler(async (event) => {
  const formData = await event.req.formData()
  return { field: formData.get('field'), text: await withTimeout(event.req.text(), 'req.text') }
}))

app.post('/web-then-stream', defineEventHandler(async (event) => {
  const web = await event.req.json()
  const stream = await withTimeout(new Response(event.req.body).text(), 'body stream')
  return { web, stream }
}))

app.post('/web-then-v1', defineEventHandler(async (event) => {
  const web = await event.req.json()
  return { web, v1: await withTimeout(readLegacyBody(toNuxtRequestEvent(event)), 'v1 readBody') }
}))

app.post('/v1-then-web', defineEventHandler(async (event) => {
  const v1 = await readLegacyBody(toNuxtRequestEvent(event))
  return { v1, web: await withTimeout(event.req.json(), 'req.json') }
}))

app.post('/read-once', defineEventHandler(async event => ({ body: await readBody(event) })))

app.use('/middleware-then-handler', defineEventHandler(async (event) => {
  event.context.requestFromMiddleware = event.req
  event.context.fromMiddleware = await event.req.json()
}))

app.post('/middleware-then-handler', defineEventHandler(async event => ({
  middleware: event.context.fromMiddleware,
  handler: await withTimeout(readBody(event), 'readBody'),
  wrappedOnce: event.req === event.context.requestFromMiddleware,
})))

const server = serve(app, { port: 0, hostname: '127.0.0.1', silent: true })
let base: string

beforeAll(async () => {
  await server.ready()
  base = server.url!.replace(/\/$/, '')
})

afterAll(async () => {
  await server.close(true)
})

function post (path: string, body: BodyInit, headers?: Record<string, string>): Promise<any> {
  return fetch(base + path, { method: 'POST', body, headers }).then(r => r.json())
}

function postJSON (path: string, body: unknown): Promise<any> {
  return post(path, JSON.stringify(body), { 'content-type': 'application/json' })
}

describe('reading a request body more than once', () => {
  it('serves an h3 read after the body was read through the web request', async () => {
    await expect(postJSON('/web-then-h3', { hello: 'world' })).resolves.toEqual({
      web: { hello: 'world' },
      h3: { hello: 'world' },
    })
  })

  it('serves a web read after the body was read through h3', async () => {
    await expect(postJSON('/h3-then-web', { hello: 'world' })).resolves.toEqual({
      h3: { hello: 'world' },
      web: { hello: 'world' },
    })
  })

  it('serves a second read through the web request', async () => {
    await expect(postJSON('/web-then-web', { hello: 'world' })).resolves.toEqual({
      first: '{"hello":"world"}',
      second: '{"hello":"world"}',
    })
  })

  it('reads a clone and the request it was cloned from', async () => {
    await expect(postJSON('/clone', { hello: 'world' })).resolves.toEqual({
      clone: '{"hello":"world"}',
      original: '{"hello":"world"}',
    })
  })

  it('serves a text read after form data was read through the web request', async () => {
    const formData = new FormData()
    formData.set('field', 'value')
    const result = await post('/formdata-then-web', formData)

    expect(result.field).toBe('value')
    expect(result.text).toContain('name="field"')
  })

  it('serves the body as a stream after it was read through the web request', async () => {
    await expect(postJSON('/web-then-stream', { hello: 'world' })).resolves.toEqual({
      web: { hello: 'world' },
      stream: '{"hello":"world"}',
    })
  })

  it('serves a v1-shimmed read after the body was read through the web request', async () => {
    await expect(postJSON('/web-then-v1', { hello: 'world' })).resolves.toEqual({
      web: { hello: 'world' },
      v1: { hello: 'world' },
    })
  })

  it('serves a web read after the body was read through a v1-shimmed reader', async () => {
    await expect(postJSON('/v1-then-web', { hello: 'world' })).resolves.toEqual({
      v1: { hello: 'world' },
      web: { hello: 'world' },
    })
  })

  it('reads the body of a handler that reads it once', async () => {
    await expect(postJSON('/read-once', { hello: 'world' })).resolves.toEqual({ body: { hello: 'world' } })
  })

  it('serves a handler read after a middleware read the body', async () => {
    await expect(postJSON('/middleware-then-handler', { hello: 'world' })).resolves.toEqual({
      middleware: { hello: 'world' },
      handler: { hello: 'world' },
      wrappedOnce: true,
    })
  })
})
