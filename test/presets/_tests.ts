import { pathToFileURL } from 'url'
import { resolve } from 'pathe'
import destr from 'destr'
import { listen, Listener } from 'listhen'
import { $fetch } from 'ohmyfetch'
import { execa } from 'execa'
import { expect, it, beforeAll, afterAll } from 'vitest'
import { fixtureDir, resolveWorkspace } from '../utils'

const isBridge = Boolean(process.env.TEST_BRIDGE)

interface Context {
  rootDir: string
  outDir: string
  fetch: (url:string) => Promise<any>
  server?: Listener
}

export function importModule (path) {
  return import(pathToFileURL(path).href)
}

export function setupTest (preset) {
  const fixture = isBridge ? 'bridge' : 'basic'
  const rootDir = fixtureDir(fixture)
  const buildDir = resolve(rootDir, '.nuxt-' + preset)

  const ctx: Context = {
    rootDir,
    outDir: resolve(buildDir, 'output'),
    fetch: url => $fetch(url, { baseURL: ctx.server!.url })
  }

  beforeAll(async () => {
    const nuxtCLI = isBridge
      ? resolve(ctx.rootDir, 'node_modules/nuxt-edge/bin/nuxt.js')
      : resolveWorkspace('packages/nuxi/bin/nuxi.mjs')

    await execa('node', [nuxtCLI, 'build', ctx.rootDir], {
      env: {
        NITRO_PRESET: preset,
        NITRO_BUILD_DIR: buildDir,
        NITRO_OUTPUT_DIR: ctx.outDir,
        NODE_ENV: 'production'
      }
    })
  }, (isBridge ? 120 : 60) * 1000)

  afterAll(async () => {
    if (ctx.server) {
      await ctx.server.close()
    }
  })

  return ctx
}

export async function startServer (ctx, handle) {
  ctx.server = await listen(handle)
}

export function testNitroBehavior (_ctx, getHandler) {
  let handler

  it('setup handler', async () => {
    handler = await getHandler()
  })

  it('SSR Works', async () => {
    const { data } = await handler({ url: '/' })
    expect(data).to.have.string('Hello Vue')
  })

  it('API Works', async () => {
    const { data: helloData } = await handler({ url: '/api/hello' })
    const { data: heyData } = await handler({ url: '/api/hey' })
    expect(destr(helloData)).to.have.string('Hello API')
    expect(destr(heyData)).to.have.string('Hey API')
  })
}
