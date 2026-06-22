import type { Nuxt } from '@nuxt/schema'
import { getPort } from 'get-port-please'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NastiDevServerPlugin } from '../../src/plugins/dev-server.ts'

vi.mock('get-port-please', () => ({ getPort: vi.fn(() => Promise.resolve(24680)) }))

function createNuxt (overrides: Record<string, any> = {}) {
  const hooks: Record<string, Array<(...args: any[]) => any>> = {}
  return {
    options: {
      app: { baseURL: '/', buildAssetsDir: '/_nuxt/' },
      devServer: { https: false, url: 'http://localhost:3000' },
      ...overrides,
    },
    hook: vi.fn((name: string, fn: (...args: any[]) => any) => {
      ;(hooks[name] ||= []).push(fn)
    }),
    callHook: vi.fn(() => Promise.resolve()),
    _hooks: hooks,
  } as unknown as Nuxt & { hook: ReturnType<typeof vi.fn>, callHook: ReturnType<typeof vi.fn>, _hooks: Record<string, Array<(...args: any[]) => any>> }
}

const runConfig = (nuxt: Nuxt, config: any, command: 'build' | 'serve') =>
  (NastiDevServerPlugin(nuxt).config as any).call({}, config, { command })

beforeEach(() => {
  vi.mocked(getPort).mockClear()
})

describe('NastiDevServerPlugin config', () => {
  it('forces HMR off in build mode and does nothing else', async () => {
    const config: any = {}
    await runConfig(createNuxt(), config, 'build')

    expect(config.server.hmr).toBe(false)
    expect(config.server.cors).toBeUndefined()
    expect(vi.mocked(getPort)).not.toHaveBeenCalled()
  })

  it('disables Nasti CORS and assigns an HMR port in serve mode', async () => {
    const config: any = {}
    await runConfig(createNuxt(), config, 'serve')

    expect(config.server.cors).toBe(false)
    expect(config.server.hmr).toEqual({ port: 24680, protocol: 'ws' })
  })

  it('uses the wss protocol when the dev server is https', async () => {
    const config: any = {}
    await runConfig(createNuxt({ devServer: { https: true } }), config, 'serve')

    expect(config.server.hmr.protocol).toBe('wss')
  })

  it('preserves a user-configured cors value', async () => {
    const config: any = { server: { cors: true } }
    await runConfig(createNuxt(), config, 'serve')

    expect(config.server.cors).toBe(true)
  })

  it('respects an explicit hmr:false without picking a port', async () => {
    const config: any = { server: { hmr: false } }
    await runConfig(createNuxt(), config, 'serve')

    expect(config.server.hmr).toBe(false)
    expect(vi.mocked(getPort)).not.toHaveBeenCalled()
  })
})

describe('NastiDevServerPlugin configureServer', () => {
  function createServer () {
    const moduleGraph = {
      getModulesByFile: vi.fn(() => [{ id: 'mod1' }]),
      invalidateModule: vi.fn(),
    }
    return {
      moduleGraph,
      server: {
        environments: { client: { moduleGraph } },
        middlewares: vi.fn(),
      },
    }
  }

  it('registers the dev handler and emits nasti:serverCreated', async () => {
    const nuxt = createNuxt()
    const { server } = createServer()

    await (NastiDevServerPlugin(nuxt).configureServer as any).call({}, server)

    expect(nuxt.callHook).toHaveBeenCalledWith('nasti:serverCreated', server)
    const devHandlerCall = nuxt.callHook.mock.calls.find(c => c[0] === 'server:devHandler')
    expect(devHandlerCall).toBeTruthy()
    expect(devHandlerCall![1]).toBeTypeOf('function')
  })

  it('invalidates client modules for regenerated templates', async () => {
    const nuxt = createNuxt()
    const { server, moduleGraph } = createServer()

    await (NastiDevServerPlugin(nuxt).configureServer as any).call({}, server)

    const handler = nuxt._hooks['app:templatesGenerated']![0]!
    handler({}, [{ dst: '/tpl.vue' }])

    expect(moduleGraph.getModulesByFile).toHaveBeenCalledWith('/tpl.vue')
    expect(moduleGraph.invalidateModule).toHaveBeenCalledWith({ id: 'mod1' })
  })

  it('scopes the default CORS allowance to build-asset requests', async () => {
    const nuxt = createNuxt()
    const { server } = createServer()

    await (NastiDevServerPlugin(nuxt).configureServer as any).call({}, server)

    const opts = nuxt.callHook.mock.calls.find(c => c[0] === 'server:devHandler')![2]
    expect(opts.cors('/_nuxt/entry.js')).toBe(true)
    expect(opts.cors('/api/users')).toBe(false)
  })

  it('hands CORS back to Nasti when the user configured it', async () => {
    const nuxt = createNuxt()
    const plugin = NastiDevServerPlugin(nuxt)
    const { server } = createServer()

    // user-set cors flips the shared `useNastiCors` flag
    await (plugin.config as any).call({}, { server: { cors: true } }, { command: 'serve' })
    await (plugin.configureServer as any).call({}, server)

    const opts = nuxt.callHook.mock.calls.find(c => c[0] === 'server:devHandler')![2]
    expect(opts.cors('/_nuxt/entry.js')).toBe(false)
  })
})
