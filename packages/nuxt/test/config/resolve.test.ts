import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalize, resolve } from 'pathe'
import type { NuxtConfig, NuxtOptions } from '@nuxt/schema'

import { resolveNuxtOptions } from '../../src/config/index.ts'

const existingPaths = new Set<string>()

vi.mock('node:fs', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: (id: string) => existingPaths.has(id) || id.endsWith('app'),
}))

const resolveConfig = resolveNuxtOptions

function withWarnings<T> (fn: () => T) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const result = fn()
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
  ])('resolves directories for %j', (config, expected) => {
    const options = resolveConfig(config)
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
  it('resolves to 5 without complaining when unset or set to 5', () => {
    for (const future of [{}, { compatibilityVersion: 5 as const }]) {
      const { result, warnings } = withWarnings(() => resolveConfig({ future }))
      expect(result.future.compatibilityVersion).toBe(5)
      expect(warnings).not.toContain('NUXT_B5029')
    }
  })

  it.each([4, 3, 6, '4'])('is forced to 5 when set to %j, and says so', (compatibilityVersion) => {
    const { result, warnings } = withWarnings(() => resolveConfig({ future: { compatibilityVersion: compatibilityVersion as 5 } }))
    expect(result.future.compatibilityVersion).toBe(5)
    expect(warnings).toContain('NUXT_B5029')
  })

  it('does not revert other defaults when set to 4', () => {
    const { result } = withWarnings(() => resolveConfig({ future: { compatibilityVersion: 4 } }))
    expect(result.router.options.sensitive).toBe(true)
    expect(result.experimental.typedPages).toBe(true)
    expect(result.experimental.asyncCallHook).toBe(false)
    expect(result.vue.optionsApi).toBe(false)
  })
})

describe('experimental', () => {
  it('defaults `watcher` to `builder` and respects an explicit value', () => {
    expect((resolveConfig({ srcDir: '/test', rootDir: '/test' })).experimental.watcher).toBe('builder')
    expect((resolveConfig({ experimental: { watcher: 'parcel' } })).experimental.watcher).toBe('parcel')
  })

  it('keeps client and server error status codes in `prerenderErrorPages`', () => {
    expect((resolveConfig({ experimental: { prerenderErrorPages: [404, 500] } })).experimental.prerenderErrorPages).toEqual([404, 500])
  })

  it('drops status codes that cannot be error pages from `prerenderErrorPages`, and says so', () => {
    const { result, warnings } = withWarnings(() => resolveConfig({ experimental: { prerenderErrorPages: [200, 404.5, 404] } }))
    expect(result.experimental.prerenderErrorPages).toEqual([404])
    expect(warnings).toContain('NUXT_B5020')
  })

  it.each([
    [undefined, false],
    [false, true],
  ])('forces `parseErrorData` on when set to %j, warning: %j', (parseErrorData, warns) => {
    const { result, warnings } = withWarnings(() => resolveConfig({ experimental: { parseErrorData } }))
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(result.experimental.parseErrorData).toBe(true)
    expect(warnings.includes('NUXT_B5016')).toBe(warns)
  })

  it.each([
    [undefined, 'automatic'],
    [true, 'manual'],
    [false, false],
    ['manual', 'manual'],
    ['automatic-immediate', 'automatic-immediate'],
    ['reload', 'automatic'],
  ])('resolves `emitRouteChunkError: %j` to %j', (emitRouteChunkError, expected) => {
    expect(resolveConfig({ experimental: { emitRouteChunkError: emitRouteChunkError as never } }).experimental.emitRouteChunkError).toBe(expected)
  })
})

describe('invalid values', () => {
  it.each<[NuxtConfig, (options: NuxtOptions) => unknown, unknown, string]>([
    [{ ssr: 'yes' as never }, options => options.ssr, true, '`ssr` was set to `"yes"`, but it has to be a boolean'],
    [{ appId: 123 as never }, options => options.appId, 'nuxt-app', '`appId` was set to `123`, but it has to be a string'],
    [{ dir: { pages: ['pages'] as never } }, options => options.dir.pages, 'pages', '`dir.pages` was set to an array, but it has to be a string'],
    [{ router: 'hash' as never }, options => options.router.options.hashMode, false, '`router` was set to `"hash"`, but it has to be an object'],
    [{ experimental: { watcher: 'fsevents' as never } }, options => options.experimental.watcher, 'builder', '`experimental.watcher` was set to `"fsevents"`, but it has to be one of'],
  ])('replaces %j with the default and warns', (config, read, expected, warning) => {
    const { result, warnings } = withWarnings(() => resolveConfig(config))
    expect(read(result)).toEqual(expected)
    expect(warnings).toContain('NUXT_B5041')
    expect(warnings).toContain(warning)
  })

  it.each<NuxtConfig>([
    {},
    { ssr: undefined, appId: undefined, router: undefined },
    { ssr: false, appId: 'my-app', dir: { pages: 'routes' }, router: { options: { hashMode: true } } },
  ])('does not warn about %j', (config) => {
    expect(withWarnings(() => resolveConfig(config)).warnings).not.toContain('NUXT_B5041')
  })
})

describe('webpack', () => {
  it.each([true, false])('keeps `url: %s` on the css loaders', (url) => {
    const { result, warnings } = withWarnings(() => resolveConfig({ webpack: { loaders: { css: { url }, cssModules: { url } } } }))
    expect(result.webpack.loaders.css.url).toBe(url)
    expect(result.webpack.loaders.cssModules.url).toBe(url)
    expect(result.webpack.loaders.css.importLoaders).toBe(0)
    expect(result.webpack.loaders.cssModules.modules).toEqual({ localIdentName: '[local]_[hash:base64:5]' })
    expect(warnings).not.toContain('NUXT_B5041')
  })

  it('merges a partial css loader `url` object with the default filter', () => {
    const { css } = resolveConfig({ webpack: { loaders: { css: { url: {} } } } }).webpack.loaders
    expect(css.url).toEqual({ filter: expect.any(Function) })
  })

  it('keeps `optimization: false`', () => {
    const { result, warnings } = withWarnings(() => resolveConfig({ webpack: { optimization: false } }))
    expect(result.webpack.optimization).toBe(false)
    expect(warnings).not.toContain('NUXT_B5041')
  })

  it('keeps `optimization.splitChunks: false`', () => {
    const { optimization } = resolveConfig({ webpack: { optimization: { splitChunks: false } } }).webpack
    expect(optimization).toMatchObject({ splitChunks: false, runtimeChunk: 'single', minimize: true })
  })
})

describe('debug', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each<[NuxtConfig['debug'], string, unknown]>([
    [false, '', false],
    [false, '1', { perf: true }],
    [{ hooks: true }, 'quiet', { hooks: true, perf: 'quiet' }],
    [{ hooks: true }, '', { hooks: true }],
  ])('resolves %j with NUXT_DEBUG_PERF=%j', (debug, perf, expected) => {
    vi.stubEnv('NUXT_DEBUG_PERF', perf)
    expect((resolveConfig({ debug })).debug).toEqual(expected)
  })

  it('enables everything for `true`', () => {
    vi.stubEnv('NUXT_DEBUG_PERF', '')
    expect((resolveConfig({ debug: true })).debug).toMatchObject({ templates: true, hooks: { client: true, server: true }, perf: true })
  })
})

describe('router.options.sensitive', () => {
  it('defaults to `true` and respects an explicit `false` value', () => {
    expect((resolveConfig({})).router.options.sensitive).toBe(true)
    expect((resolveConfig({ router: { options: { sensitive: false } } })).router.options.sensitive).toBe(false)
  })
})

describe('devServer', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults `host` to undefined', () => {
    for (const key of ['NUXT_HOST', 'NITRO_HOST', 'HOST']) {
      vi.stubEnv(key, '')
    }
    expect((resolveConfig({})).devServer.host).toBeUndefined()
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
  ])('`allowedHosts` %s', (_, config, expected) => {
    expect((resolveConfig(config)).devServer.allowedHosts).toEqual(expected)
  })
})

describe('postcss.order', () => {
  it('reports an unknown preset as an error and marks it as reported', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      let thrown: any
      try {
        resolveConfig({ postcss: { order: 'unknown-preset' as never } })
      } catch (err) {
        thrown = err
      }
      expect(thrown.name).toBe('NUXT_B5015')
      expect(thrown[Symbol.for('nuxt.diagnostic.reported')]).toBe(true)
      expect(error).toHaveBeenCalledWith(expect.stringContaining('NUXT_B5015'))
    } finally {
      error.mockRestore()
    }
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
  ])('resolves %s', (_, config, expected) => {
    expect((resolveConfig(config)).vite.cacheDir).toBe(expected)
  })

  it('resolves under rootDir when it has its own node_modules', () => {
    existingPaths.add(resolve('/project/apps/foo', 'node_modules'))
    expect((resolveConfig({ rootDir: '/project/apps/foo', workspaceDir: '/project' })).vite.cacheDir).toBe(resolve('/project/apps/foo', 'node_modules/.cache/vite'))
  })
})

describe('resolved options', () => {
  const isMutable = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !(value instanceof RegExp)

  function collectObjects (value: unknown, objects = new Set<object>()) {
    if (isMutable(value) && !objects.has(value)) {
      objects.add(value)
      for (const key in value) {
        collectObjects(value[key], objects)
      }
    }
    return objects
  }

  function findShared (value: unknown, objects: Set<object>, path = ''): string[] {
    if (!isMutable(value)) {
      return []
    }
    if (objects.has(value)) {
      return [path]
    }
    return Object.keys(value).flatMap(key => findShared(value[key], objects, path ? `${path}.${key}` : key))
  }

  it('share no objects or arrays between two resolutions', () => {
    const objects = collectObjects(resolveConfig({ rootDir: '/project' }))
    expect(findShared(resolveConfig({ rootDir: '/project' }), objects)).toEqual([])
  })
})
