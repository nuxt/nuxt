import type { Nuxt } from '@nuxt/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { nitroStub, buildMock, createServerMock, resolvePathMock } = vi.hoisted(() => ({
  nitroStub: { options: { virtual: {} as Record<string, any>, _config: { virtual: {} as Record<string, any> }, publicAssets: [] as any[] } },
  buildMock: vi.fn(),
  createServerMock: vi.fn(),
  resolvePathMock: vi.fn((p: string) => Promise.resolve(p)),
}))

vi.mock('@nasti-toolchain/nasti', () => ({ build: buildMock, createServer: createServerMock }))

vi.mock('@nuxt/kit', async orig => ({
  ...(await orig() as object),
  useNitro: () => nitroStub,
  resolvePath: resolvePathMock,
  tryUseNuxt: () => ({}),
  resolveAlias: (id: string) => id,
  directoryToURL: (d: string) => d,
}))

const { bundle } = await import('../src/nasti.ts')

const PROD_PLUGINS = [
  'nuxt:nasti:client-manifest',
  'nuxt:nasti:dev-server',
  'nuxt:nasti:public-dir-resolution-dev',
  'nuxt:nasti:public-dir-resolution',
  'nuxt:nasti:replace:client',
  'nuxt:nasti:replace:server',
  'nuxt:nasti:ssr-styles',
  'nuxt:nasti:runtime-paths',
  'nuxt:nasti:module-preload-polyfill',
]

const DEV_PLUGINS = [
  'nuxt:nasti:client-manifest',
  'nuxt:nasti:node-server',
  'nuxt:nasti:dev-server',
  'nuxt:nasti:public-dir-resolution-dev',
  'nuxt:nasti:public-dir-resolution',
  'nuxt:nasti:replace:client',
  'nuxt:nasti:replace:server',
  'nuxt:nasti:runtime-paths',
  'nuxt:nasti:module-preload-polyfill',
]

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    _version: '3.99.0',
    options: {
      dev: false,
      ssr: true,
      rootDir: '/repo',
      srcDir: '/repo/app',
      appDir: '/repo/app-dir',
      buildDir: '/repo/.nuxt',
      logLevel: 'info',
      test: false,
      dir: { assets: 'assets' },
      app: { baseURL: '/', buildAssetsDir: '/_nuxt/' },
      alias: {},
      sourcemap: { client: true, server: false },
      experimental: { asyncEntry: false, asyncContext: false },
      features: { inlineStyles: true },
      vite: {},
      ...overrides,
    },
    apps: { default: { mainComponent: '/repo/app/app.vue' } },
    callHook: vi.fn(() => Promise.resolve()),
    hook: vi.fn(),
  } as unknown as Nuxt & { callHook: ReturnType<typeof vi.fn>, hook: ReturnType<typeof vi.fn> }
}

function capturedConfig (nuxt: any) {
  return nuxt.callHook.mock.calls.find((c: any[]) => c[0] === 'nasti:configResolved')![1]
}

beforeEach(() => {
  nitroStub.options.virtual = {}
  nitroStub.options._config.virtual = {}
  buildMock.mockReset().mockResolvedValue(undefined)
  createServerMock.mockReset().mockResolvedValue({ close: vi.fn() })
  resolvePathMock.mockClear()
})

describe('bundle (production)', () => {
  it('runs the production build and prepends Nuxt plugins in order', async () => {
    const nuxt = createNuxt({ dev: false })
    await bundle(nuxt)

    const config = capturedConfig(nuxt)
    expect(config.plugins.map((p: any) => p.name)).toEqual(PROD_PLUGINS)
    expect(buildMock).toHaveBeenCalledWith(config)
    expect(createServerMock).not.toHaveBeenCalled()
    expect(nuxt.callHook).toHaveBeenCalledWith('nasti:compiled')
  })

  it('fires nasti:extend before nasti:configResolved', async () => {
    const nuxt = createNuxt({ dev: false })
    await bundle(nuxt)

    const types = nuxt.callHook.mock.calls.map(c => c[0])
    expect(types.indexOf('nasti:extend')).toBeLessThan(types.indexOf('nasti:configResolved'))
    expect(types.indexOf('nasti:extend')).toBeGreaterThanOrEqual(0)
  })

  it('omits ssr-styles when inlineStyles is disabled', async () => {
    const nuxt = createNuxt({ dev: false, features: { inlineStyles: false } })
    await bundle(nuxt)

    expect(capturedConfig(nuxt).plugins.map((p: any) => p.name)).not.toContain('nuxt:nasti:ssr-styles')
  })

  it('uses the SPA entry as the server entry when SSR is disabled', async () => {
    const nuxt = createNuxt({ dev: false, ssr: false })
    await bundle(nuxt)

    expect(capturedConfig(nuxt).environments.ssr.entry).toMatch(/entry-spa$/)
    expect(resolvePathMock).toHaveBeenCalledWith(expect.stringContaining('entry-spa'))
  })
})

describe('bundle (development)', () => {
  it('boots the dev server, registers cleanup, and includes the node-server plugin', async () => {
    const nuxt = createNuxt({ dev: true })
    await bundle(nuxt)

    const config = capturedConfig(nuxt)
    expect(config.plugins.map((p: any) => p.name)).toEqual(DEV_PLUGINS)
    expect(createServerMock).toHaveBeenCalledWith(config)
    expect(buildMock).not.toHaveBeenCalled()
    expect(nuxt.hook).toHaveBeenCalledWith('close', expect.any(Function))
    expect(nuxt.callHook).toHaveBeenCalledWith('nasti:compiled')
  })
})
