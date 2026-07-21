import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

import { builder, isBuilt } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/nitro-vite-environment', import.meta.url))

describe.skipIf(builder !== 'nitro-vite' || isBuilt)('nitro/vite environment dev middleware', () => {
  let nuxt: Awaited<ReturnType<typeof import('@nuxt/kit').loadNuxt>>
  let server: http.Server
  let port: number

  beforeAll(async () => {
    nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      dev: true,
    })
    await buildNuxt(nuxt)
    server = http.createServer(nuxt.server!.handler).listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
    port = (server.address() as AddressInfo).port
  }, 240 * 1000)

  afterAll(async () => {
    await new Promise<void>(resolve => server?.close(() => resolve()))
    await nuxt?.close()
  })

  it.each([
    ['without sec-fetch-dest', undefined],
    ['with sec-fetch-dest: script', 'script'],
  ])('serves @vite/client under buildAssetsDir %s', async (_, secFetchDest) => {
    const buildAssetsDir = nuxt.options.app.buildAssetsDir
    const url = `http://127.0.0.1:${port}${buildAssetsDir}@vite/client`
    const res = await fetch(url, secFetchDest ? { headers: { 'sec-fetch-dest': secFetchDest } } : undefined)
    expect(res.status, `${url} (sec-fetch-dest=${secFetchDest ?? 'unset'})`).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/(text|application)\/javascript/)
    // Drain so Vite doesn't hold the socket open and block server close.
    await res.arrayBuffer()
  }, 120 * 1000)
})
