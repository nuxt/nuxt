import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'

import { runsOnceInMatrix } from './matrix'
import { buildInProcess, fixturePath } from './utils'

const rootDir = fixturePath('vite-server-ssr')

describe.skipIf(!runsOnceInMatrix)('pure vite server build under a base URL', () => {
  const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-base-url')
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-base-url')
  let render: (path: string) => Promise<Response>

  beforeAll(async () => {
    await buildInProcess(rootDir, { buildDir, app: { baseURL: '/app/' }, nitro: { output: { dir: outputDir } } })

    const server = await import(join(outputDir, 'server/index.mjs')) as {
      default: { fetch: (request: Request) => Promise<Response> }
    }
    render = path => server.default.fetch(new Request(new URL(path, 'http://localhost')))
  }, 240 * 1000)

  it('renders the route requested under the base URL', async () => {
    for (const path of ['/app', '/app/']) {
      const response = await render(path)
      expect(response.status, path).toBe(200)
      expect(await response.text(), path).toContain('<p id="greeting">hello from runtime config</p>')
    }

    expect(await (await render('/app/about')).text()).toContain('<p id="about"> about page </p>')
    expect(await (await render('/app/users/42')).text()).toContain('<p id="user">42 at /users/42</p>')
  })

  it('applies route rules to a route under the base URL', async () => {
    const shell = await (await render('/app/spa')).text()

    expect(shell).not.toContain('id="spa"')
    expect(shell).toContain('data-ssr="false"')
  })

  it('fetches a path of the app in-process while rendering', async () => {
    expect(await (await render('/app/fetched')).text()).toContain('<p id="fetched">fetched the about page</p>')
  })

  it('serves the public directory and the client build under the base URL', async () => {
    expect(await (await render('/app/static.txt')).text()).toContain('static-asset')

    const html = await (await render('/app/')).text()
    const scripts = Array.from(html.matchAll(/<script type="module" src="([^"]+)"/g), match => match[1]!)
    expect(scripts.length).toBeGreaterThan(0)
    for (const src of scripts) {
      expect(src).toMatch(/^\/app\/_nuxt\//)
      const response = await render(src)
      expect(response.status, src).toBe(200)
      expect(await response.text(), src).not.toBe('')
    }
  })

  it('redirects a request outside the base URL under it', async () => {
    const response = await render('/about?a=1')

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/app/about?a=1')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite prerendered build under a base URL', () => {
  const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-base-url-generate')
  const publicDir = join(rootDir, 'node_modules/.cache/nuxt/.output-base-url-generate/public')

  beforeAll(async () => {
    await buildInProcess(rootDir, {
      buildDir,
      app: { baseURL: '/app/' },
      nitro: { static: true, output: { dir: join(publicDir, '..') }, prerender: { routes: ['/users/42'], ignore: ['/request'] } },
    })
  }, 240 * 1000)

  it('prerenders each route at its path relative to the base URL', async () => {
    expect(await readFile(join(publicDir, 'index.html'), 'utf-8')).toContain('<p id="greeting">hello from runtime config</p>')
    expect(await readFile(join(publicDir, 'about/index.html'), 'utf-8')).toContain('<p id="about"> about page </p>')
    expect(await readFile(join(publicDir, 'users/42/index.html'), 'utf-8')).toContain('<p id="user">42 at /users/42</p>')
  })
})
