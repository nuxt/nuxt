import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildNuxt, loadNuxt } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'

import { runsOnceInMatrix } from './matrix'

const rootDir = fileURLToPath(new URL('./fixtures/vite-server-universal-deploy', import.meta.url))
const publicDir = join(rootDir, '.output/public')

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target', () => {
  let serverBuild: Nuxt['serverBuild']
  let artifact: { default: { fetch: (request: Request) => Promise<Response> } }

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

    artifact = await import(pathToFileURL(join(rootDir, '.output/server/index.mjs')).href)
  }, 240 * 1000)

  it('publishes the client build for the target to serve', async () => {
    expect(await readFile(join(publicDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
  })

  it('leaves the emitted entry to the target that claimed the input', () => {
    expect(serverBuild.runtime.handler).toBeUndefined()
  })

  it('renders through the entry the target routes to', async () => {
    const response = await artifact.default.fetch(new Request('https://example.com/about'))

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<p id="about-page">')
  })
})
