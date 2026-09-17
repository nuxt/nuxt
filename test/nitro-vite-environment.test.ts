import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

import { builder, isBuilt } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/nitro-vite-environment', import.meta.url))

describe.skipIf(builder !== 'nitro-vite' || !isBuilt)('nitro/vite environment prerender', () => {
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-prerender')

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-prerender'),
        nitro: {
          output: { dir: outputDir },
          prerender: { routes: ['/'] },
          // inlining vue-router is what makes the prerenderer read `__VUE_PROD_DEVTOOLS__`
          noExternals: ['vue-router'],
        },
      },
    })
    const nodeEnv = process.env.NODE_ENV
    try {
      // vue-router only reads the flag in a production bundle
      process.env.NODE_ENV = 'production'
      await buildNuxt(nuxt)
    } finally {
      if (nodeEnv === undefined) {
        delete process.env.NODE_ENV
      } else {
        process.env.NODE_ENV = nodeEnv
      }
      await nuxt.close()
    }
  }, 240 * 1000)

  it('prerenders a page that uses vue-router', async () => {
    expect(await readFile(join(outputDir, 'public/index.html'), 'utf-8')).toContain('nitro-vite-environment')
  })
})

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
    ['@vite/client', 'without sec-fetch-dest', undefined],
    ['@vite/client', 'with sec-fetch-dest: script', 'script'],
    ['@id/__x00__test-virtual-module', 'without sec-fetch-dest', undefined],
    ['@id/__x00__test-virtual-module', 'with sec-fetch-dest: script', 'script'],
  ])('serves %s under buildAssetsDir %s', async (path, _, secFetchDest) => {
    const buildAssetsDir = nuxt.options.app.buildAssetsDir
    const url = `http://127.0.0.1:${port}${buildAssetsDir}${path}`
    const res = await fetch(url, secFetchDest ? { headers: { 'sec-fetch-dest': secFetchDest } } : undefined)
    expect(res.status, `${url} (sec-fetch-dest=${secFetchDest ?? 'unset'})`).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/(text|application)\/javascript/)
    // Drain so Vite doesn't hold the socket open and block server close.
    await res.arrayBuffer()
  }, 120 * 1000)

  it('does not substitute the server constants inside string literals', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/string-literals`)
    await expect(res.json()).resolves.toEqual({ vueFlag: 'flag __VUE_PROD_DEVTOOLS__ in a string' })
  }, 120 * 1000)
})
