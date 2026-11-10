import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyDefaults } from 'untyped'
import { normalize, resolve } from 'pathe'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtConfig, NuxtOptions } from '../src/index.ts'

const existingPaths = new Set<string>()

vi.mock('node:fs', () => ({
  existsSync: (id: string) => existingPaths.has(id) || id.endsWith('app'),
}))

const resolveConfig = (config: NuxtConfig) => applyDefaults(NuxtConfigSchema, config as never) as unknown as Promise<NuxtOptions>

async function withWarnings<T> (fn: () => Promise<T>) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const result = await fn()
    return { result, warnings: warn.mock.calls.map(call => String(call[0])).join('\n') }
  } finally {
    warn.mockRestore()
  }
}

describe('folder structure', () => {
  const stripRoot = (dir: string) => normalize(dir).replace(normalize(process.cwd()), '<cwd>')

  it.each<[NuxtConfig, Record<string, string>]>([
    [{}, { rootDir: '<cwd>', srcDir: '<cwd>/app', serverDir: '<cwd>/server', app: '<cwd>/app', modules: '<cwd>/modules', public: '<cwd>/public' }],
    [{ srcDir: 'src/', rootDir: '/test' }, { rootDir: '/test', srcDir: '/test/src', serverDir: '/test/server', app: '/test/src', modules: '/test/modules', public: '/test/public' }],
    [{ serverDir: '/myServer' }, { rootDir: '<cwd>', srcDir: '<cwd>/app', serverDir: '/myServer', app: '<cwd>/app', modules: '<cwd>/modules', public: '<cwd>/public' }],
  ])('resolves directories for %j', async (config, expected) => {
    const options = await resolveConfig(config)
    expect({
      rootDir: stripRoot(options.rootDir),
      srcDir: stripRoot(options.srcDir),
      serverDir: stripRoot(options.serverDir),
      app: stripRoot(options.dir.app),
      modules: stripRoot(options.dir.modules),
      public: stripRoot(options.dir.public),
    }).toEqual(expected)
    expect(stripRoot(options.workspaceDir!)).toBe(expected.rootDir)
  })
})

describe('future.compatibilityVersion', () => {
  it('resolves to 5 without complaining when unset or set to 5', async () => {
    for (const future of [{}, { compatibilityVersion: 5 as const }]) {
      const { result, warnings } = await withWarnings(() => resolveConfig({ future }))
      expect(result.future.compatibilityVersion).toBe(5)
      expect(warnings).not.toContain('NUXT_B5029')
    }
  })

  it.each([4, 3, 6, '4'])('is forced to 5 when set to %j, and says so', async (compatibilityVersion) => {
    const { result, warnings } = await withWarnings(() => resolveConfig({ future: { compatibilityVersion: compatibilityVersion as 5 } }))
    expect(result.future.compatibilityVersion).toBe(5)
    expect(warnings).toContain('NUXT_B5029')
  })

  it('does not revert other defaults when set to 4', async () => {
    const { result } = await withWarnings(() => resolveConfig({ future: { compatibilityVersion: 4 } }))
    expect(result.router.options.sensitive).toBe(true)
    expect(result.experimental.typedPages).toBe(true)
    expect(result.experimental.asyncCallHook).toBe(false)
    expect(result.vue.optionsApi).toBe(false)
  })
})

describe('experimental', () => {
  it('defaults `watcher` to `builder` and respects an explicit value', async () => {
    expect((await resolveConfig({ srcDir: '/test', rootDir: '/test' })).experimental.watcher).toBe('builder')
    expect((await resolveConfig({ experimental: { watcher: 'parcel' } })).experimental.watcher).toBe('parcel')
  })

  it('keeps client and server error status codes in `prerenderErrorPages`', async () => {
    expect((await resolveConfig({ experimental: { prerenderErrorPages: [404, 500] } })).experimental.prerenderErrorPages).toEqual([404, 500])
  })

  it('drops status codes that cannot be error pages from `prerenderErrorPages`, and says so', async () => {
    const { result, warnings } = await withWarnings(() => resolveConfig({ experimental: { prerenderErrorPages: [200, 404.5, 404] } }))
    expect(result.experimental.prerenderErrorPages).toEqual([404])
    expect(warnings).toContain('NUXT_B5020')
  })

  it.each([
    [undefined, false],
    [false, true],
  ])('forces `parseErrorData` on when set to %j, warning: %j', async (parseErrorData, warns) => {
    const { result, warnings } = await withWarnings(() => resolveConfig({ experimental: { parseErrorData } }))
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.experimental.parseErrorData).toBe(true)
    expect(warnings.includes('NUXT_B5016')).toBe(warns)
  })
})

describe('router.options.sensitive', () => {
  it('defaults to `true` and respects an explicit `false` value', async () => {
    expect((await resolveConfig({})).router.options.sensitive).toBe(true)
    expect((await resolveConfig({ router: { options: { sensitive: false } } })).router.options.sensitive).toBe(false)
  })
})

describe('devServer', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults `host` to undefined', async () => {
    for (const key of ['NUXT_HOST', 'NITRO_HOST', 'HOST']) {
      vi.stubEnv(key, '')
    }
    expect((await resolveConfig({})).devServer.host).toBeUndefined()
  })

  it.each<[string, NuxtConfig, string[] | true]>([
    ['defaults to an empty list', {}, []],
    ['includes devServer.host and vite.server.allowedHosts', {
      devServer: { host: 'my-machine.lan', allowedHosts: ['.example.com'] },
      vite: { server: { allowedHosts: ['proxy.test', 'my-machine.lan'] } },
    }, ['.example.com', 'proxy.test', 'my-machine.lan']],
    ['includes devServer.host when no other option lists it', { devServer: { host: 'my-machine.lan' } }, ['my-machine.lan']],
    ['allows any host when devServer.allowedHosts is true', { devServer: { allowedHosts: true } }, true],
    ['allows any host when vite.server.allowedHosts is true', { vite: { server: { allowedHosts: true } } }, true],
  ])('`allowedHosts` %s', async (_, config, expected) => {
    expect((await resolveConfig(config)).devServer.allowedHosts).toEqual(expected)
  })
})

describe('vite.cacheDir', () => {
  afterEach(() => {
    existingPaths.clear()
  })

  it.each<[string, NuxtConfig, string]>([
    ['under workspaceDir when rootDir matches workspaceDir', { rootDir: '/project', workspaceDir: '/project' }, resolve('/project', 'node_modules/.cache/vite')],
    ['under workspaceDir when nested rootDir has no node_modules', { rootDir: '/project/src', workspaceDir: '/project' }, resolve('/project', 'node_modules/.cache/vite/src')],
    ['per app in a workspace', { rootDir: '/project/apps/foo', workspaceDir: '/project' }, resolve('/project', 'node_modules/.cache/vite/apps/foo')],
    ['per app in a workspace, without collisions', { rootDir: '/project/apps_foo', workspaceDir: '/project' }, resolve('/project', 'node_modules/.cache/vite/apps_foo')],
    ['under rootDir when workspaceDir is not an ancestor', { rootDir: '/project/src', workspaceDir: '/project/src/nested' }, resolve('/project/src', 'node_modules/.cache/vite')],
    ['to an explicit vite.cacheDir', { rootDir: '/project/src', workspaceDir: '/project', vite: { cacheDir: '/custom/cache' } }, '/custom/cache'],
  ])('resolves %s', async (_, config, expected) => {
    expect((await resolveConfig(config)).vite.cacheDir).toBe(expected)
  })

  it('resolves under rootDir when it has its own node_modules', async () => {
    existingPaths.add(resolve('/project/apps/foo', 'node_modules'))
    expect((await resolveConfig({ rootDir: '/project/apps/foo', workspaceDir: '/project' })).vite.cacheDir).toBe(resolve('/project/apps/foo', 'node_modules/.cache/vite'))
  })
})
