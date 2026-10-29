import { createServer, get } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, eventHandler, toNodeListener } from 'h3'

import { toRequestEvent } from '../src/runtime/utils/event.ts'

const app = createApp()

app.use(eventHandler((event) => {
  const url = toRequestEvent(event).url
  return { path: event.path, url: url.pathname, search: url.search }
}))

const server = createServer(toNodeListener(app))
let port: number

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  port = (server.address() as AddressInfo).port
})

afterAll(() => {
  server.close()
})

function request (path: string): Promise<{ status: number, body: any }> {
  return new Promise((resolve, reject) => {
    get({ host: '127.0.0.1', port, path }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(data) }))
    }).on('error', reject)
  })
}

describe('renderer request event url', () => {
  it.each([
    '/./admin',
    '/%2e/admin',
    '/%2E/admin',
    '/../admin',
    '/.%2e/admin',
    '/x/../admin',
    '/x/%2e%2e/admin',
    '/admin/.',
    '/admin/..?query',
  ])('rejects dot segments in %s', async (path) => {
    await expect(request(path)).resolves.toMatchObject({ status: 404 })
  })

  it.each([
    '/admin',
    '/admin?redirect=/./x',
    '/.well-known/x',
    '/a.b/...',
    '/%61dmin',
  ])('reads %s with the same path as h3', async (path) => {
    const { status, body } = await request(path)
    expect(status).toBe(200)
    expect(body.url).toBe(body.path.split('?')[0])
  })

  it('reads a path that starts with a double slash as a path', async () => {
    const { status, body } = await request('//foo:bar/')
    expect(status).toBe(200)
    expect(body.url).toBe('/foo:bar/')
  })

  it.each([
    '//foo:bar/',
    '//:80/x',
    '//a:b/',
    '//%41/',
    '//[x]/',
    '//x^y/',
  ])('reads %s with the same path as its single-slash form', async (path) => {
    const { status, body } = await request(path)
    const equivalent = await request(path.replace(/^\/+/, '/'))
    expect(status).toBe(200)
    expect(body.url).toBe(equivalent.body.url)
  })

  it('keeps the query when the path starts with a double slash', async () => {
    const { status, body } = await request('//foo:bar/?a=1')
    expect(status).toBe(200)
    expect(body.url).toBe('/foo:bar/')
    expect(body.search).toBe('?a=1')
  })
})
