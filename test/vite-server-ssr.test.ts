import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { glob } from 'tinyglobby'
import { parse } from 'acorn'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { isWindows } from 'std-env'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-ssr', import.meta.url))

if (runsOncePerEnvInMatrix && isDev) {
  await setup({
    rootDir,
    dev: true,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix || !isDev)('pure vite dev server with ssr', () => {
  it('renders the app on the server', async () => {
    const html = await $fetch<string>('/')

    expect(html).toContain('<h1>vite-server-ssr</h1>')
    expect(html).toContain('<p id="greeting">hello from runtime config</p>')
    expect(html).toContain('data-ssr="true"')
    // transformed by vite, so the client that hydrates the render is the dev client
    expect(html).toContain('/_nuxt/@vite/client')
  })

  it('renders the route that was requested', async () => {
    const html = await $fetch<string>('/about')

    expect(html).toContain('<p id="about"> about page </p>')
    expect(html).toContain('<title>About</title>')
  })

  it('serves files from the public directory', async () => {
    expect(await $fetch<string>('/static.txt')).toContain('static-asset')
  })

  it('renders the error page for a route no page matches', async () => {
    const response = await fetch('/not-a-page')

    expect(response.status).toBe(404)
    expect(await response.text()).toContain('id="__nuxt"')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite server build', () => {
  const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build')
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-build')
  let html: string
  let render: (path: string) => Promise<Response>

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: { buildDir, nitro: { output: { dir: outputDir } } },
    })
    try {
      await buildNuxt(nuxt)
      expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    } finally {
      await nuxt.close()
    }

    // the entry only listens when it is the main module
    const server = await import(join(outputDir, 'server/index.mjs')) as {
      default: { fetch: (request: Request) => Promise<Response> }
    }
    render = path => server.default.fetch(new Request(new URL(path, 'http://localhost')))
    html = await (await render('/')).text()
  }, 240 * 1000)

  it('renders the app', () => {
    expect(html).toContain('<h1>vite-server-ssr</h1>')
    expect(html).toContain('<title>Pure Vite SSR</title>')
    expect(html).toContain('<meta name="description" content="rendered on the server">')
  })

  it('resolves data on the server and serialises it into the payload', () => {
    expect(html).toContain('<p id="async-data">from useAsyncData</p>')
    expect(html).toContain('"rendered":5},"from useAsyncData"')
    expect(html).toContain('data-ssr="true"')
  })

  it('inlines public runtime config', () => {
    expect(html).toContain('<p id="greeting">hello from runtime config</p>')
    expect(html).toContain('"hello from runtime config"')
  })

  it('links the client build the document hydrates with', () => {
    expect(html).toMatch(/<script type="module" src="\/_nuxt\/[^"]+\.js"/)
    expect(html).toContain('"#entry"')
  })

  it('renders each route it serves', async () => {
    expect(await (await render('/about')).text()).toContain('<p id="about"> about page </p>')
  })

  it('serves the public directory in front of the renderer', async () => {
    const response = await render('/static.txt')

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('static-asset')
  })

  it('renders the error page for a route no page matches', async () => {
    const response = await render('/not-a-page')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/html;charset=utf-8')
    expect(await response.text()).toContain('id="__nuxt"')
  })

  it('leaves no static document in front of the renderer', async () => {
    await expect(readFile(join(outputDir, 'public/index.html'), 'utf-8')).rejects.toThrow()
  })

  it('bundles every dependency into the server output', async () => {
    const files = await glob('**/*.mjs', { cwd: join(outputDir, 'server'), absolute: true })
    const specifiers = new Set<string>()
    for (const file of files) {
      const program = parse(await readFile(file, 'utf-8'), { ecmaVersion: 'latest', sourceType: 'module' })
      for (const node of program.body) {
        if ((node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source) {
          specifiers.add(node.source.value as string)
        }
      }
    }

    expect(specifiers.size).toBeGreaterThan(0)
    expect([...specifiers].filter(specifier => !specifier.startsWith('node:') && !specifier.startsWith('.'))).toEqual([])
  })
})
