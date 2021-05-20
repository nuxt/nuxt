import { RequestListener } from 'http'
import { resolve } from 'upath'
import destr from 'destr'
import consola from 'consola'
import { Listener, listen } from 'listhen'
import { $fetch } from 'ohmyfetch/node'
import createRequire from 'create-require'
import { fixtureDir, buildFixture, loadFixture } from '../utils'
import type { LoadNuxtOptions } from '@nuxt/kit'

const isCompat = Boolean(process.env.TEST_COMPAT)

export interface TestContext {
  rootDir: string
  outDir: string
  nuxt?: any
  fetch: (url: string) => Promise<any>
  server?: Listener
}

export interface AbstractRequest {
  url: string
  headers?: any
  method?: string
  body?: any
}

export interface AbstractResponse {
  data: string
}

export type AbstractHandler = (req: AbstractRequest) => Promise<AbstractResponse>

export function setupTest (): TestContext {
  const fixture = isCompat ? 'compat' : 'basic'
  const rootDir = fixtureDir(fixture)
  const outDir = resolve(__dirname, '.output', fixture)

  const ctx: TestContext = {
    rootDir,
    outDir,
    fetch: url => $fetch<any>(url, { baseURL: ctx.server.url })
  }

  beforeAll(() => {
    jest.mock('jiti', () => createRequire)
    consola.wrapAll()
    consola.mock(() => jest.fn())
  })

  afterAll(async () => {
    if (ctx.nuxt) {
      await ctx.nuxt.close()
    }
    if (ctx.server) {
      await ctx.server.close()
    }
  })

  return ctx
}

export function testNitroBuild (ctx: TestContext, preset: string) {
  test('nitro build', async () => {
    ctx.outDir = resolve(ctx.outDir, preset)

    const loadOpts: LoadNuxtOptions = { rootDir: ctx.rootDir, dev: false, version: isCompat ? 2 : 3 }
    await buildFixture(loadOpts)
    const nuxt = await loadFixture(loadOpts, {
      nitro: {
        preset,
        minify: false,
        serveStatic: false,
        externals: preset === 'cloudflare' ? false : { trace: false },
        output: { dir: ctx.outDir }
      }
    })
    await nuxt.callHook('build:done', {})
    ctx.nuxt = nuxt
  }, 60000)
}

export async function startServer (ctx: TestContext, handle: RequestListener) {
  ctx.server = await listen(handle)
}

export function testNitroBehavior (_ctx: TestContext, getHandler: () => Promise<AbstractHandler>) {
  let handler

  test('setup handler', async () => {
    handler = await getHandler()
  })

  test('SSR Works', async () => {
    const { data } = await handler({ url: '/' })
    expect(data).toMatch('Hello Vue')
  }, 10000)

  test('API Works', async () => {
    const { data } = await handler({ url: '/api/hello' })
    expect(destr(data)).toEqual('Hello API')
  })
}
