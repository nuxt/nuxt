import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, createRouter, eventHandler, readBody, readRawBody, toNodeListener } from 'h3'
import type { H3Event } from 'h3'

import { toPortableEvent } from '../src/runtime/utils/event.ts'

const RAW_BODY = Symbol.for('h3RawBody')

function withTimeout<T> (promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} did not settle`)), 1000)),
  ])
}

const app = createApp()
const router = createRouter()

router.post('/web-then-h3', eventHandler(async (event) => {
  const web = await toPortableEvent(event).req.json()
  return { web, h3: await withTimeout(readBody(event), 'readBody') }
}))

router.post('/h3-then-web', eventHandler(async (event) => {
  const h3 = await readBody(event)
  return { h3, web: await withTimeout(toPortableEvent(event).req.json(), 'req.json') }
}))

router.post('/web-then-web', eventHandler(async (event) => {
  const first = await toPortableEvent(event).req.text()
  return { first, second: await withTimeout(toPortableEvent(event).req.clone().text(), 'clone') }
}))

router.post('/clone', eventHandler(async (event) => {
  const request = toPortableEvent(event).req
  const clone = await withTimeout(request.clone().text(), 'clone')
  return { clone, original: await withTimeout(request.text(), 'original') }
}))

router.post('/formdata-then-h3', eventHandler(async (event) => {
  const formData = await toPortableEvent(event).req.formData()
  return { field: formData.get('field'), h3: await withTimeout(readRawBody(event), 'readRawBody') }
}))

let unreadEvent: H3Event | undefined
router.post('/unread', eventHandler((event) => {
  unreadEvent = event
  return { url: toPortableEvent(event).url.pathname }
}))

app.use(router)

const server = createServer(toNodeListener(app))
let base: string

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, () => resolve()))
  base = `http://localhost:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

function post (path: string, body: BodyInit, headers?: Record<string, string>): Promise<any> {
  return fetch(base + path, { method: 'POST', body, headers }).then(r => r.json())
}

function postJSON (path: string, body: unknown): Promise<any> {
  return post(path, JSON.stringify(body), { 'content-type': 'application/json' })
}

describe('portable event body', () => {
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

  it('clones a request whose body has already been read', async () => {
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

  it('serves an h3 read after form data was read through the web request', async () => {
    const formData = new FormData()
    formData.set('field', 'value')
    const result = await post('/formdata-then-h3', formData)
    expect(result.field).toBe('value')
    expect(result.h3).toContain('name="field"')
  })

  it('leaves the request stream alone when the request is never read', async () => {
    await expect(postJSON('/unread', { hello: 'world' })).resolves.toEqual({ url: '/unread' })
    expect(RAW_BODY in unreadEvent!.node.req).toBe(false)
  })
})
