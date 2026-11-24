import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

describe.skipIf(builder !== 'nitro-vite' || !isBuilt)('nitro/vite environment shared modules', () => {
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-shared')
  let fetchHandler: (request: Request) => Promise<Response>

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-shared'),
        nitro: {
          preset: 'standard',
          output: { dir: outputDir },
        },
      },
    })
    await buildNuxt(nuxt)
    await nuxt.close()

    const server = await import(pathToFileURL(join(outputDir, 'server/index.mjs')).href) as { default: { fetch: typeof fetchHandler } }
    fetchHandler = server.default.fetch
  }, 240 * 1000)

  it('keeps one module instance for the ssr renderer and server routes', async () => {
    const route = () => fetchHandler(new Request('http://localhost/api/shared-state')).then(r => r.json())
    const page = () => fetchHandler(new Request('http://localhost/')).then(r => r.text())

    const first = await route() as { sawSsr: boolean, nitroSeen: number }
    expect(first).toMatchObject({ sawSsr: false, nitroSeen: 1 })

    expect(await page()).toContain('sawNitro=true')

    expect(await route()).toEqual({ sawSsr: true, ssrSeen: 1, nitroSeen: 2, marks: ['nitro', 'ssr'] })
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
    server = http.createServer((req, res) => nuxt.server!.handler(req, res)).listen(0, '127.0.0.1')
    await new Promise<void>(resolve => server.once('listening', () => resolve()))
    port = (server.address() as AddressInfo).port
    await nuxt.callHook('listen', server, {})
    await buildNuxt(nuxt)
  }, 240 * 1000)

  afterAll(async () => {
    server?.closeAllConnections()
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

  it.each([
    ['/_dev-handler/', 'dev-handler/file.woff2', undefined],
    ['<buildAssetsDir>', 'dev-handler/file', undefined],
    ['<buildAssetsDir>', 'dev-handler/file', 'font'],
    ['<buildAssetsDir>', 'dev-handler/file.woff2', undefined],
    ['<buildAssetsDir>', 'dev-handler/file.js', 'script'],
    ['<buildAssetsDir>', 'dev-handler/file.json?import', undefined],
    ['/_dev-handler/', 'dev-middleware/file.woff2', undefined],
    ['<buildAssetsDir>', 'dev-middleware/file', undefined],
    ['<buildAssetsDir>', 'dev-middleware/file', 'font'],
    ['<buildAssetsDir>', 'dev-middleware/file.woff2', undefined],
    ['<buildAssetsDir>', 'dev-middleware/file.woff2', 'font'],
    ['<buildAssetsDir>', 'dev-middleware/file.js', 'script'],
  ])('routes %s%s to a dev server handler (sec-fetch-dest=%s)', async (prefix, path, secFetchDest) => {
    const base = prefix === '<buildAssetsDir>' ? nuxt.options.app.buildAssetsDir : prefix
    const url = `http://127.0.0.1:${port}${base}${path}`
    const res = await fetch(url, secFetchDest ? { headers: { 'sec-fetch-dest': secFetchDest } } : undefined)
    expect(res.status, url).toBe(200)
    await expect(res.text()).resolves.toBe(`dev-handler:${base}${path.replace(/\?.*$/, '')}`)
  }, 120 * 1000)

  it.each([
    ['/public-script.js', undefined, 'console.log("public-script")\n'],
    ['/public-script.js', 'script', 'console.log("public-script")\n'],
    ['/public-style.css', undefined, 'body { color: rebeccapurple }\n'],
    ['/public-style.css', 'style', 'body { color: rebeccapurple }\n'],
  ])('serves public file %s as written (sec-fetch-dest=%s)', async (path, secFetchDest, contents) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, secFetchDest ? { headers: { 'sec-fetch-dest': secFetchDest } } : undefined)
    expect(res.status, path).toBe(200)
    await expect(res.text()).resolves.toBe(contents)
  }, 120 * 1000)

  it('handles websocket upgrades for nitro routes', async () => {
    // TODO: remove after upgrading past nitro 3.0.260903-beta (https://github.com/nitrojs/nitro/pull/4711)
    await fetch(`http://127.0.0.1:${port}/api/string-literals`).then(res => res.arrayBuffer())
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/ws`)
    try {
      await new Promise((resolve, reject) => {
        ws.onopen = resolve
        ws.onerror = reject
      })
      const message = new Promise<string>((resolve) => {
        ws.onmessage = event => resolve(String(event.data))
      })
      ws.send('ping')
      await expect(message).resolves.toBe('echo:ping')
    } finally {
      ws.close()
    }
  }, 120 * 1000)

  it('leaves vite hmr upgrades to vite', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${nuxt.options.app.buildAssetsDir}`, 'vite-hmr')
    try {
      const message = new Promise<string>((resolve, reject) => {
        ws.onmessage = event => resolve(String(event.data))
        ws.onerror = reject
      })
      await expect(message.then(JSON.parse)).resolves.toMatchObject({ type: 'connected' })
    } finally {
      ws.close()
    }
  }, 120 * 1000)

  it('does not substitute the server constants inside string literals', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/string-literals`)
    await expect(res.json()).resolves.toEqual({ vueFlag: 'flag __VUE_PROD_DEVTOOLS__ in a string' })
  }, 120 * 1000)
})
