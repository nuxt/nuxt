import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { isWindows } from 'std-env'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import type { Nuxt } from 'nuxt/schema'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-universal-deploy-netlify', import.meta.url))
const publicDir = join(rootDir, '.output/public')

if (runsOncePerEnvInMatrix && isDev) {
  await setup({
    rootDir,
    dev: true,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

describe.skipIf(!runsOncePerEnvInMatrix || !isDev)('universal-deploy dev server with netlify emulation', () => {
  it('renders through the target', async () => {
    const html = await (await fetch('/about')).text()

    expect(html).toContain('<p id="about-page">')
    expect(html).toContain('data-ssr="true"')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target on netlify', () => {
  let serverBuild: Nuxt['serverBuild']

  beforeAll(async () => {
    const nuxt = await loadNuxt({
      cwd: rootDir,
      ready: true,
      overrides: { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') },
    })
    try {
      await buildNuxt(nuxt)
      expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
      serverBuild = nuxt.serverBuild
    } finally {
      await nuxt.close()
    }
  }, 240 * 1000)

  it('publishes the client build for the target to serve', async () => {
    expect(await readFile(join(publicDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
  })

  it('leaves the emitted entry to the target that claimed the input', () => {
    expect(serverBuild.runtime.handler).toBeUndefined()
  })

  it('deploys the entry the target routes to as the function netlify renders with', async () => {
    const handler = await import(pathToFileURL(join(rootDir, '.netlify/v1/functions/server.mjs')).href) as {
      default: (request: Request) => Promise<Response>
    }

    const response = await handler.default(new Request('https://example.com/about'))
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<p id="about-page">')
  })
})
