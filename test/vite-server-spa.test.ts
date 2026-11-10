import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'
import { buildInProcess, fixturePath, setupFixture } from './utils'

const rootDir = fixturePath('vite-server-spa')

const runsDev = runsOncePerEnvInMatrix && isDev

await setupFixture('vite-server-spa', runsDev)

describe.skipIf(!runsDev)('pure vite dev server', () => {
  it('serves the SPA shell for a navigation request', async () => {
    const html = await $fetch<string>('/', { headers: { accept: 'text/html' } })
    expect(html).toContain('<div id="__nuxt">')
    expect(html).toContain('window.__NUXT__=')
    // injected by vite's own `transformIndexHtml`, along with the html transforms of
    // every configured plugin
    expect(html).toContain('/_nuxt/@vite/client')
  })

  it('serves the same shell for a client-only route', async () => {
    expect(await $fetch<string>('/about', { headers: { accept: 'text/html' } })).toContain('<div id="__nuxt">')
  })

  it('renders the shell through renderer plugins for each navigation', async () => {
    const html = await $fetch<string>('/about', { headers: { accept: 'text/html' } })
    expect(html.match(/<meta name="renderer-plugin"[^>]*>/g)).toEqual(['<meta name="renderer-plugin" content="request /about">'])
    expect(html).toContain('<meta name="renderer-plugin-config" content="hello from runtime config">')
    expect(html).toMatch(/<body[^>]* data-renderer-plugin>/)
  })

  it('serves files from the public directory', async () => {
    expect(await $fetch<string>('/static.txt')).toContain('static-asset')
  })

  it('serves client modules from the build assets directory', async () => {
    expect(await $fetch<string>('/_nuxt/@vite/client')).toContain('createHotContext')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite static SPA build', () => {
  const configuredDir = join(rootDir, 'node_modules/.cache/nuxt/.client-outdir-override')
  let html: string

  beforeAll(async () => {
    await rm(configuredDir, { recursive: true, force: true })
    // built in-process rather than through the CLI, so the suite also covers a build
    // that never initialises a server
    // its own build directory, so a concurrently running dev project cannot rewrite the
    // output between the build and the assertions
    const nuxt = await buildInProcess(rootDir, {
      buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build'),
      // client build options the builder has to override
      vite: {
        $client: {
          build: {
            outDir: configuredDir,
            rolldownOptions: { input: join(rootDir, 'app/app.vue') },
          },
        },
      },
    })
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    html = await readFile(join(rootDir, '.output/public/index.html'), 'utf-8')
  }, 240 * 1000)

  it('writes the client build to the public directory of the output, not the configured `outDir`', () => {
    expect(existsSync(configuredDir)).toBe(false)
  })

  it('emits an SPA entry document', () => {
    expect(html).toContain('<div id="__nuxt">')
    expect(html).toContain('<title>Pure Vite SPA</title>')
    // linked by vite, which owns the document as an html build input
    expect(html).toMatch(/<script type="module"[^>]* src="\.\/_nuxt\/[^"]+\.js">/)
  })

  it('renders the document through renderer plugins, as a prerendered route', () => {
    expect(html.match(/<meta name="renderer-plugin"[^>]*>/g)).toEqual(['<meta name="renderer-plugin" content="prerender /">'])
    expect(html).toContain('<meta name="renderer-plugin-config" content="hello from runtime config">')
    expect(html).toMatch(/<body[^>]* data-renderer-plugin>/)
  })

  it('renders the built-in loading template', () => {
    expect(html).toContain('id="__nuxt-loader"')
    expect(html).toContain('nuxt-spa-loading')
  })

  it('inlines public runtime config for the client', () => {
    expect(html).toContain('hello from runtime config')
    expect(html).toContain('"serverRendered":false')
  })

  it('emits fallback documents for static hosts', async () => {
    for (const file of ['200.html', '404.html']) {
      expect(await readFile(join(rootDir, '.output/public', file), 'utf-8')).toBe(html)
    }
  })

  it('copies the public directory', async () => {
    expect(await readFile(join(rootDir, '.output/public/static.txt'), 'utf-8')).toContain('static-asset')
  })

  it('maps the `#entry` specifier to the emitted entry chunk', () => {
    const [, entry] = html.match(/<script type="importmap">.*?"#entry":"\.\/([^"]+)"/) || []
    expect(entry).toBeTruthy()
    expect(html).toContain(`src="./${entry}"`)
  })

  it('emits every asset the document references', async () => {
    const references = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(match => match[1]!)
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      await expect(readFile(join(rootDir, '.output/public', reference), 'utf-8')).resolves.toBeTruthy()
    }
  })

  it('does not emit a server bundle', async () => {
    await expect(readFile(join(rootDir, '.output/server/index.mjs'), 'utf-8')).rejects.toThrow()
  })
})
