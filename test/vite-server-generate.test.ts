import { fileURLToPath } from 'node:url'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { glob } from 'tinyglobby'
import { parse } from 'devalue'
import { chromium } from 'playwright-core'

import { runsOnceInMatrix } from './matrix'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

function serveStatically (dir: string): Promise<{ origin: string, close: () => Promise<void> }> {
  const server: Server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname
    const candidates = [join(dir, path), join(dir, path, 'index.html'), join(dir, '404.html')]
    const file = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile())
    if (!file) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(file.endsWith('404.html') ? 404 : 200, { 'content-type': CONTENT_TYPES[extname(file)] || 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(done => server.close(() => done())),
      })
    })
  })
}

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-generate', import.meta.url))
const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build')
const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-generate')
const publicDir = join(outputDir, 'public')

function read (path: string) {
  return readFile(join(publicDir, path), 'utf-8')
}

describe.skipIf(!runsOnceInMatrix)('pure vite prerendered build', () => {
  let files: string[]

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        buildDir,
        nitro: { static: true, output: { dir: outputDir } },
      },
    })
    try {
      await buildNuxt(nuxt)
      expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    } finally {
      await nuxt.close()
    }

    files = (await glob('**/*', { cwd: publicDir })).sort()
  }, 240 * 1000)

  it('writes an html file per prerendered route', () => {
    expect(files.filter(file => file.endsWith('.html'))).toEqual([
      '200.html',
      '404.html',
      'about/index.html',
      'blog/crawled/index.html',
      'hinted/from-hint/index.html',
      'index.html',
      'links/index.html',
      'rules/prerendered/index.html',
    ])
  })

  it('server-renders each route it wrote', async () => {
    expect(await read('index.html')).toContain('<h1>vite-server-generate</h1>')
    expect(await read('index.html')).toContain('<p id="async-data">from useAsyncData</p>')
    expect(await read('about/index.html')).toContain('<title>About</title>')
    expect(await read('about/index.html')).toContain('<p id="about">about data</p>')
    expect(await read('rules/prerendered/index.html')).toContain('id="rules-prerendered"')
  })

  it('follows `prerenderRoutes()` hints to reach a dynamic route', async () => {
    expect(await read('hinted/from-hint/index.html')).toContain('hint from-hint')
  })

  it('follows links in the rendered html to reach a dynamic route', async () => {
    expect(await read('blog/crawled/index.html')).toContain('blog post crawled')
  })

  it('ignores links that cannot become a static file', () => {
    expect(files.filter(file => file.includes('price'))).toEqual([])
    expect(files.filter(file => file.includes('?'))).toEqual([])
  })

  it('skips routes the configuration excludes', () => {
    expect(files).not.toContain('ignored/index.html')
    expect(files).not.toContain('rules/ignored/index.html')
    expect(files).not.toContain('ignored/_payload.json')
    expect(files).not.toContain('rules/ignored/_payload.json')
  })

  it('writes a payload beside each prerendered route', async () => {
    expect(files.filter(file => file.endsWith('_payload.json'))).toEqual([
      '_payload.json',
      'about/_payload.json',
      'blog/crawled/_payload.json',
      'hinted/from-hint/_payload.json',
      'links/_payload.json',
      'rules/prerendered/_payload.json',
    ])

    const payload = parse(await read('about/_payload.json'), { ShallowReactive: value => value }) as { data: Record<string, unknown> }
    expect(payload.data.about).toBe('about data')
  })

  it('points the document at the payload the client loads on hydration', async () => {
    const html = await read('about/index.html')

    expect(html).toContain('data-src="/about/_payload.json')
    expect(html).toContain('rel="preload" as="fetch" crossorigin="anonymous" href="/about/_payload.json')
  })

  it('writes the spa fallbacks a static host serves unknown paths from', async () => {
    for (const file of ['200.html', '404.html']) {
      const html = await read(file)
      expect(html).toContain('<div id="__nuxt"></div>')
      expect(html).toContain('data-ssr="false"')
    }
  })

  it('lists the prerendered routes in the app manifest', async () => {
    const [meta] = await glob('_nuxt/builds/meta/*.json', { cwd: publicDir })
    const manifest = JSON.parse(await read(meta!)) as { id: string, prerendered: string[] }

    expect(manifest.prerendered.sort()).toEqual([
      '/',
      '/about',
      '/blog/crawled',
      '/hinted/from-hint',
      '/links',
      '/rules/prerendered',
    ])
    expect(JSON.parse(await read('_nuxt/builds/latest.json'))).toMatchObject({ id: manifest.id })
  })

  it('copies the public directory into the output', async () => {
    expect(await read('static.txt')).toContain('static-asset')
  })

  it('leaves nothing but the static site in the output', () => {
    expect(existsSync(join(outputDir, 'server'))).toBe(false)
    expect(files).not.toContain('manifest.json')
  })

  it('writes the same routes as the same fixture generated with nitro', async () => {
    const nitroOutputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-nitro-generate')
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-nitro-build'),
        server: { builder: 'nitro' },
        nitro: { static: true, output: { dir: nitroOutputDir } },
      },
    })
    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }

    const html = await glob('**/*.html', { cwd: join(nitroOutputDir, 'public') })

    expect(html.sort()).toEqual(files.filter(file => file.endsWith('.html')))
  }, 240 * 1000)
})

describe.skipIf(!runsOnceInMatrix)('prerendered output served statically', () => {
  let host: Awaited<ReturnType<typeof serveStatically>>
  let browser: Awaited<ReturnType<typeof chromium.launch>>

  beforeAll(async () => {
    host = await serveStatically(publicDir)
    browser = await chromium.launch()
  }, 120 * 1000)

  afterAll(async () => {
    await browser?.close()
    await host?.close()
  })

  it('hydrates the prerendered document and navigates with the prerendered payloads', async () => {
    const page = await browser.newPage()
    const payloadRequests: string[] = []
    page.on('request', request => void (request.url().includes('_payload.json') && payloadRequests.push(new URL(request.url()).pathname)))

    await page.goto(host.origin, { waitUntil: 'networkidle' })
    expect(await page.locator('#async-data').textContent()).toContain('from useAsyncData')

    await page.locator('#about-link').click()
    await page.waitForSelector('#about')
    expect(await page.locator('#about').textContent()).toContain('about data')
    expect(payloadRequests).toContain('/about/_payload.json')

    expect(await page.evaluate(() => document.querySelectorAll('#__nuxt').length)).toBe(1)
    await page.close()
  }, 120 * 1000)
})
