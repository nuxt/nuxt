import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'

import { glob } from 'tinyglobby'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'
import { buildInProcess, fixturePath, setupFixture } from './utils'
import { channelState, frameAt, renderErrorPage } from './dev-error-utils'

// workerd provides `node:async_hooks` and `node:diagnostics_channel`, and nothing else the
// render reaches for; these are what a node server would drag in
const NODE_SERVER_BUILTINS = new Set(['node:fs', 'node:fs/promises', 'node:http', 'node:https', 'node:net', 'node:path', 'node:stream', 'node:stream/promises', 'node:zlib'])

const rootDir = fixturePath('vite-server-cloudflare-v2')
const outputDir = join(rootDir, '.cloudflare/output/v0/workers/default')
const bundleDir = join(outputDir, 'bundle')
const assetsDir = join(outputDir, 'assets')

const runsDev = runsOncePerEnvInMatrix && isDev

await setupFixture('vite-server-cloudflare-v2', runsDev)

describe.skipIf(!runsDev)('pure vite dev server with the cloudflare vite plugin v2', () => {
  it('renders the routes the worker passes to `#server-entry` in the worker runtime', async () => {
    const response = await fetch('/runtime', { headers: { accept: 'text/html' } })

    expect(response.status).toBe(200)
    expect(await response.text()).toMatch(/<p id="runtime">\s*Cloudflare-Workers\s*<\/p>/)
  })

  it('renders app code that reads the browser globals the worker runtime does not have', async () => {
    const response = await fetch('/announcer', { headers: { accept: 'text/html' } })

    expect(response.status).toBe(200)
    expect(await response.text()).toMatch(/<p id="announcer">\s*polite\s*<\/p>/)
  })

  it('answers a request the worker fails with an error, and keeps serving', async () => {
    const response = await fetch('/api/throw')
    expect(response.status).toBe(500)

    const page = await fetch('/about', { headers: { accept: 'text/html' } })
    expect(page.status).toBe(200)
  })

  it('reports an error the worker raises to the request that raised it', async () => {
    await fetch('/api/throw')
    await expect.poll(async () => (await channelState('/api/throw')).current, { timeout: 5000 }).toMatchObject({ kind: 'error', message: 'boom from the worker' })
    expect((await channelState('/about')).current).toBeUndefined()
  })

  it('reports errors raised by the app the worker renders', async () => {
    const { status, report } = await renderErrorPage('/boom')

    expect(status).toBe(500)
    expect(report.message).toBe('boom from a page the worker renders')
    expect(frameAt(report, 'app/pages/boom.vue')).toMatchObject({ type: 'app', line: 2 })
  })

  it('keeps the report open while another page renders, and retires it once the worker renders its page', async () => {
    const { report } = await renderErrorPage('/flaky')
    expect((await channelState('/flaky')).current?.id).toBe(report.id)

    await fetch('/about', { headers: { accept: 'text/html' } })
    await new Promise(resolve => setTimeout(resolve, 500))
    expect((await channelState('/flaky')).current?.id).toBe(report.id)

    const fixed = await fetch('/flaky', { headers: { 'accept': 'text/html', 'x-boom': 'fixed' } })
    expect(fixed.status).toBe(200)
    await expect.poll(async () => (await channelState('/flaky')).current?.id, { timeout: 5000 }).not.toBe(report.id)
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite build with the cloudflare vite plugin v2', () => {
  let config: { manifest: { mainModule: string } }
  let worker: { default: { fetch: (request: Request) => Promise<Response> } }

  beforeAll(async () => {
    const nuxt = await buildInProcess(rootDir, { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') })
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    config = JSON.parse(await readFile(join(outputDir, 'worker.config.json'), 'utf-8'))
    worker = await import(pathToFileURL(join(bundleDir, config.manifest.mainModule)).href)
  }, 240 * 1000)

  it('writes the client build into the assets of the build output', async () => {
    expect(await readFile(join(assetsDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(assetsDir, 'manifest.json'), 'utf-8')).rejects.toThrow()
    // the worker renders every route, so there is no document in front of it
    await expect(readFile(join(assetsDir, 'index.html'), 'utf-8')).rejects.toThrow()
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
      expect(existsSync(join(assetsDir, asset))).toBe(true)
    }
  })

  it('bundles the render for workerd, which has no node server to run', async () => {
    const files = await glob('**/*.mjs', { cwd: bundleDir, absolute: true })
    const specifiers = new Set<string>()
    for (const file of files) {
      for (const [, specifier] of (await readFile(file, 'utf-8')).matchAll(/['"](node:[^'"]+)['"]/g)) {
        specifiers.add(specifier!)
      }
    }

    expect([...specifiers].filter(specifier => NODE_SERVER_BUILTINS.has(specifier))).toEqual([])
  })
})
