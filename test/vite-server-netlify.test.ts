import { fileURLToPath, pathToFileURL } from 'node:url'
import { lookup } from 'node:dns/promises'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { isWindows } from 'std-env'
import { fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-netlify', import.meta.url))
const publicDir = join(rootDir, '.output/public')

// the function is called back over `127.0.0.1`, so it is unreachable where `localhost`
// resolves to `::1` first
const reachesFunctions = await lookup('localhost').then(({ family }) => family === 4, () => false)

if (runsOncePerEnvInMatrix && isDev) {
  await setup({
    rootDir,
    dev: true,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix || !isDev)('netlify dev emulation', () => {
  it('applies the redirect rules of the target', async () => {
    const response = await fetch('/legacy-about', { redirect: 'manual' })

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toContain('/about')
  })

  it('renders everything the target does not match', async () => {
    const html = await (await fetch('/about')).text()

    expect(html).toContain('<p id="about-page">')
    expect(html).toContain('data-ssr="true"')
    expect(html).toContain('/_nuxt/@vite/client')
  })

  it.skipIf(!reachesFunctions)('serves the routes of the target from its own functions', async () => {
    const response = await fetch('/api/hello')

    expect(await response.json()).toEqual({ message: 'hello from the function' })
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite build with a netlify deploy target', () => {
  let config: string

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
    config = await readFile(join(rootDir, 'netlify.toml'), 'utf-8')
  }, 240 * 1000)

  it('publishes the client build netlify is configured to deploy', async () => {
    expect(config).toContain('publish = ".output/public"')

    expect(await readFile(join(publicDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(publicDir, 'manifest.json'), 'utf-8')).rejects.toThrow()
    // the function renders every route, so there is no document in front of it
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
  })

  it('deploys the server build as the function netlify renders with', async () => {
    const handler = await import(pathToFileURL(join(rootDir, '.netlify/v1/functions/server.mjs')).href) as {
      default: (request: Request) => Promise<Response>
      config: { path: string, preferStatic: boolean }
    }

    expect(handler.config).toMatchObject({ path: '/*', preferStatic: true })

    const response = await handler.default(new Request('https://example.com/about'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<p id="about-page">')
  })
})
