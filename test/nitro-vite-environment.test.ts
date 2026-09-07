import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { join } from 'pathe'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { NitroConfig } from 'nitro/types'

import { builder, isBuilt } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/nitro-vite-environment', import.meta.url))

describe.skipIf(builder !== 'nitro-vite' || !isBuilt)('nitro/vite environment prerender', () => {
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-prerender')
  let prerendererConfig: NitroConfig | undefined

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: false,
      overrides: {
        buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-prerender'),
        nitro: { output: { dir: outputDir }, prerender: { routes: ['/'] } },
      },
    })
    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('prerender:config', (config) => { prerendererConfig = config })
    })
    try {
      await nuxt.ready()
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }
  }, 240 * 1000)

  it('passes the server replacements to the prerenderer', () => {
    expect(prerendererConfig?.replace?.__VUE_PROD_DEVTOOLS__).toBe('false')
    // vitest sets the `test` option. The value is not stable here.
    expect(prerendererConfig?.replace?.['import.meta.test']).toMatch(/^(?:true|false)$/)
  })

  it('writes the prerendered route', () => {
    expect(existsSync(join(outputDir, 'public/index.html'))).toBe(true)
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
})
