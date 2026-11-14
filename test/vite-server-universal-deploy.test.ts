import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Nuxt } from 'nuxt/schema'

import { runsOnceInMatrix } from './matrix'
import { buildInProcess, fixturePath } from './utils'

const rootDir = fixturePath('vite-server-universal-deploy')
const publicDir = join(rootDir, '.output/public')

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target', () => {
  let serverBuild: Nuxt['serverBuild']
  let artifact: { default: { fetch: (request: Request) => Promise<Response> } }
  const targets: Array<string | undefined> = []

  beforeAll(async () => {
    const nuxt = await buildInProcess(rootDir, { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') }, nuxt => targets.push(nuxt.serverBuild.target?.()))
    targets.push(nuxt.serverBuild.target?.())
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    serverBuild = nuxt.serverBuild

    artifact = await import(pathToFileURL(join(rootDir, '.output/server/index.mjs')).href)
  }, 240 * 1000)

  it('reports `node` as the deploy target once the build has resolved its config', () => {
    expect(targets).toEqual([undefined, 'node'])
  })

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
