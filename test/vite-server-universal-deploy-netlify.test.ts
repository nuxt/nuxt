import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { join } from 'pathe'
import { beforeAll, describe, expect, it } from 'vitest'
import { fetch } from '@nuxt/test-utils/e2e'
import type { Nuxt } from 'nuxt/schema'

import { isDev, runsOnceInMatrix, runsOncePerEnvInMatrix } from './matrix'
import { buildInProcess, fixturePath, setupFixture } from './utils'

const rootDir = fixturePath('vite-server-universal-deploy-netlify')
const publicDir = join(rootDir, '.output/public')

const runsDev = runsOncePerEnvInMatrix && isDev

await setupFixture('vite-server-universal-deploy-netlify', runsDev)

describe.skipIf(!runsDev)('universal-deploy dev server with netlify emulation', () => {
  it('renders through the target', async () => {
    const html = await (await fetch('/about')).text()

    expect(html).toContain('<p id="about-page">')
    expect(html).toContain('data-ssr="true"')
  })
})

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target on netlify', () => {
  let serverBuild: Nuxt['serverBuild']
  const targets: Array<string | undefined> = []

  beforeAll(async () => {
    const nuxt = await buildInProcess(rootDir, { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') }, nuxt => targets.push(nuxt.serverBuild.target?.()))
    targets.push(nuxt.serverBuild.target?.())
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    serverBuild = nuxt.serverBuild
  }, 240 * 1000)

  it('reports `netlify` as the deploy target before and after the build', () => {
    expect(targets).toEqual(['netlify', 'netlify'])
  })

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
