import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'

import { runsOnceInMatrix } from './matrix'
import { buildInProcess, fixturePath } from './utils'

const rootDir = fixturePath('vite-server-universal-deploy')
const publicDir = join(rootDir, '.output/public')

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target', () => {
  let artifact: { default: { fetch: (request: Request) => Promise<Response> } }

  beforeAll(async () => {
    const nuxt = await buildInProcess(rootDir, { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') })
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()

    artifact = await import(pathToFileURL(join(rootDir, '.output/server/index.mjs')).href)
  }, 240 * 1000)

  it('publishes the client build for the target to serve', async () => {
    expect(await readFile(join(publicDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
  })

  it('renders through the entry the target routes to', async () => {
    const response = await artifact.default.fetch(new Request('https://example.com/about'))

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<p id="about-page">')
  })
})
