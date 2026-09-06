import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'

import { glob } from 'tinyglobby'

import { runsOnceInMatrix } from './matrix'

// workerd provides `node:async_hooks` and `node:diagnostics_channel`, and nothing else the
// render reaches for; these are what a node server would drag in
const NODE_SERVER_BUILTINS = new Set(['node:fs', 'node:fs/promises', 'node:http', 'node:https', 'node:net', 'node:path', 'node:stream', 'node:stream/promises', 'node:zlib'])

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-cloudflare', import.meta.url))
const workerDir = join(rootDir, '.output/nuxt_vite_server_cloudflare')
const publicDir = join(rootDir, '.output/public')

describe.skipIf(!runsOnceInMatrix)('pure vite build with a cloudflare deploy target', () => {
  let wrangler: { main: string, assets: { directory: string, not_found_handling: string } }
  let worker: { default: { fetch: (request: Request) => Promise<Response> } }

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') },
    })
    try {
      await buildNuxt(nuxt)
      expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    } finally {
      await nuxt.close()
    }
    wrangler = JSON.parse(await readFile(join(workerDir, 'wrangler.json'), 'utf-8'))
    worker = await import(pathToFileURL(join(workerDir, 'index.js')).href)
  }, 240 * 1000)

  it('points the worker at the assets the builder wrote, and at itself for everything else', () => {
    expect(wrangler.assets).toMatchObject({
      directory: '../public',
      not_found_handling: 'none',
    })
  })

  it('writes the client build into the public directory of the output', async () => {
    await expect(readFile(join(publicDir, 'manifest.json'), 'utf-8')).rejects.toThrow()
    // the worker renders every route, so there is no document in front of it
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
  })

  it('serves worker routes and renders everything else itself', async () => {
    const api = await worker.default.fetch(new Request('https://example.com/api/hello'))
    expect(await api.json()).toEqual({ message: 'hello from the worker' })

    const page = await worker.default.fetch(new Request('https://example.com/about'))
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('<p id="about-page">')
  })

  it('renders against the client build, which has to be built before the worker', async () => {
    const html = await (await worker.default.fetch(new Request('https://example.com/about'))).text()
    const assets = [...html.matchAll(/(?:src|href)="(\/_nuxt\/[^"]+)"/g)].map(([, asset]) => asset!)

    expect(assets.length).toBeGreaterThan(0)
    for (const asset of assets) {
      expect(existsSync(join(publicDir, asset))).toBe(true)
    }
  })

  it('bundles the render for workerd, which has no node server to run', async () => {
    const files = await glob('**/*.js', { cwd: workerDir, absolute: true })
    const specifiers = new Set<string>()
    for (const file of files) {
      for (const [, specifier] of (await readFile(file, 'utf-8')).matchAll(/['"](node:[^'"]+)['"]/g)) {
        specifiers.add(specifier!)
      }
    }

    expect([...specifiers].filter(specifier => NODE_SERVER_BUILTINS.has(specifier))).toEqual([])
  })
})
