import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-spa', import.meta.url))

if (runsOncePerEnvInMatrix && isDev) {
  await setup({
    rootDir,
    dev: true,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix || !isDev)('pure vite dev server', () => {
  it('serves the SPA shell for a navigation request', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('<div id="__nuxt">')
    expect(html).toContain('window.__NUXT__=')
    // injected by vite's own `transformIndexHtml`, along with the html transforms of
    // every configured plugin
    expect(html).toContain('/_nuxt/@vite/client')
  })

  it('serves the same shell for a client-only route', async () => {
    expect(await $fetch<string>('/about')).toContain('<div id="__nuxt">')
  })

  it('serves files from the public directory', async () => {
    expect(await $fetch<string>('/static.txt')).toContain('static-asset')
  })

  it('serves client modules from the build assets directory', async () => {
    expect(await $fetch<string>('/_nuxt/@vite/client')).toContain('createHotContext')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite static SPA build', () => {
  let html: string

  beforeAll(async () => {
    // built in-process rather than through the CLI, so the suite also covers a build
    // that never initialises a server
    // its own build directory, so a concurrently running dev project cannot rewrite the
    // output between the build and the assertions
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
    html = await readFile(join(rootDir, '.output/public/index.html'), 'utf-8')
  }, 240 * 1000)

  it('emits an SPA entry document', () => {
    expect(html).toContain('<div id="__nuxt">')
    expect(html).toContain('<title>Pure Vite SPA</title>')
    // linked by vite, which owns the document as an html build input
    expect(html).toMatch(/<script type="module"[^>]* src="\.\/_nuxt\/[^"]+\.js">/)
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

describe.skipIf(!runsOnceInMatrix)('server environment', () => {
  const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-ssr')
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-ssr')

  beforeAll(async () => {
    const nuxt = await loadNuxt({ cwd: rootDir, ready: true, overrides: { ssr: true, buildDir, nitro: { output: { dir: outputDir } } } })
    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }
  }, 240 * 1000)

  it('builds the server environment for a plugin or custom server to run', async () => {
    const entry = await readFile(join(buildDir, 'dist/server/server.mjs'), 'utf-8')
    expect(entry).toContain('vue/server-renderer')
  })

  it('still emits a client document', async () => {
    expect(await readFile(join(outputDir, 'public/index.html'), 'utf-8')).toContain('<div id="__nuxt">')
  })
})

describe.skipIf(!runsOnceInMatrix)('overridden client build options', () => {
  const buildDir = join(rootDir, 'node_modules/.cache/nuxt/.nuxt-client-overrides')
  const outputDir = join(rootDir, 'node_modules/.cache/nuxt/.output-client-overrides')
  const configuredDir = join(rootDir, 'node_modules/.cache/nuxt/.client-outdir-override')

  beforeAll(async () => {
    await rm(configuredDir, { recursive: true, force: true })
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: {
        buildDir,
        nitro: { output: { dir: outputDir } },
        vite: {
          $client: {
            build: {
              outDir: configuredDir,
              rolldownOptions: { input: join(rootDir, 'app/app.vue') },
            },
          },
        },
      },
    })
    try {
      await buildNuxt(nuxt)
    } finally {
      await nuxt.close()
    }
  }, 240 * 1000)

  it('writes the client build to the public directory of the output', async () => {
    expect(await readFile(join(outputDir, 'public/index.html'), 'utf-8')).toContain('<div id="__nuxt">')
    expect(existsSync(configuredDir)).toBe(false)
  })

  it('keeps the document and the app entry as build inputs', async () => {
    const html = await readFile(join(outputDir, 'public/index.html'), 'utf-8')

    expect(html).toMatch(/<script type="module"[^>]* src="\.\/_nuxt\/[^"]+\.js">/)
    expect(html).toContain('"#entry"')
  })
})
