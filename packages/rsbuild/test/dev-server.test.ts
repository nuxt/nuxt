import type { Nuxt } from '@nuxt/schema'
import type { RsbuildInstance } from '@rsbuild/core'
import { describe, expect, it, vi } from 'vitest'

import { setupDevServer } from '../src/dev-server.ts'

async function createDevHandler () {
  let handler!: (event: unknown) => Promise<unknown>
  const middlewares = vi.fn((_req: unknown, res: { end: () => void }) => res.end())
  const nuxt = {
    _devServerListener: {},
    options: { app: { baseURL: '/', buildAssetsDir: '/_nuxt/' }, devServer: {} },
    hook: vi.fn(),
    callHook: vi.fn((_name: string, devHandler: typeof handler) => { handler = devHandler }),
  } as unknown as Nuxt
  const rsbuild = {
    createDevServer: () => Promise.resolve({ middlewares, environments: {}, connectWebSocket: vi.fn(), afterListen: vi.fn(), close: vi.fn() }),
  } as unknown as RsbuildInstance
  await setupDevServer(nuxt, rsbuild)

  return async (url: string, site: string) => {
    const res = { statusCode: 200, end: vi.fn(), once: vi.fn() }
    const result = await handler({ runtime: { node: { req: { url, headers: { 'host': 'localhost:3000', 'sec-fetch-site': site } }, res } } })
    return { status: res.statusCode, handled: result === Symbol.for('h3.handled'), ended: res.end.mock.calls, served: middlewares.mock.calls.length > 0 }
  }
}

describe('rsbuild dev handler', () => {
  it.each(['/', '/_nuxt/builds/latest.json', '/_nuxt/entry.js'])('rejects a cross-site request to %s', async (url) => {
    const request = await createDevHandler()
    expect(await request(url, 'cross-site')).toEqual({ status: 403, handled: true, ended: [['Forbidden']], served: false })
  })

  it('passes same-origin app requests on to Nuxt', async () => {
    const request = await createDevHandler()
    expect(await request('/', 'same-origin')).toEqual({ status: 200, handled: false, ended: [], served: false })
  })
})
