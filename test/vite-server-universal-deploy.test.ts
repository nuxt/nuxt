import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import process from 'node:process'
import { readFile } from 'node:fs/promises'
import { getRandomPort } from 'get-port-please'
import { join } from 'pathe'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Nuxt } from 'nuxt/schema'

import { runsOnceInMatrix } from './matrix'
import { buildInProcess, fixturePath } from './utils'

const rootDir = fixturePath('vite-server-universal-deploy')
const publicDir = join(rootDir, '.output/public')

describe.skipIf(!runsOnceInMatrix)('pure vite build with a universal-deploy target', () => {
  let serverBuild: Nuxt['serverBuild']
  let server: ChildProcess | undefined
  let url: string
  const targets: Array<string | undefined> = []

  beforeAll(async () => {
    const nuxt = await buildInProcess(rootDir, { buildDir: join(rootDir, 'node_modules/.cache/nuxt/.nuxt-build') }, nuxt => targets.push(nuxt.serverBuild.target?.()))
    targets.push(nuxt.serverBuild.target?.())
    expect((nuxt as { _nitro?: unknown })._nitro).toBeUndefined()
    serverBuild = nuxt.serverBuild

    const port = await getRandomPort('127.0.0.1')
    url = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [join(rootDir, '.output/server/index.mjs')], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
      stdio: 'ignore',
    })
    await vi.waitFor(() => fetch(url), { timeout: 10_000, interval: 100 })
  }, 240 * 1000)

  afterAll(() => {
    server?.kill()
  })

  it('reports `node` as the deploy target once the build has resolved its config', () => {
    expect(targets).toEqual([undefined, 'node'])
  })

  it('publishes the client build for the target to serve', async () => {
    expect(await readFile(join(publicDir, 'static.txt'), 'utf-8')).toContain('static-asset')
    await expect(readFile(join(publicDir, 'index.html'), 'utf-8')).rejects.toThrow()
    expect(await (await fetch(`${url}/static.txt`)).text()).toContain('static-asset')
  })

  it('leaves the emitted entry to the target that claimed the input', () => {
    expect(serverBuild.runtime.handler).toBeUndefined()
  })

  it('renders through the server the target emits', async () => {
    const response = await fetch(`${url}/about`)

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<p id="about-page">')
  })
})
