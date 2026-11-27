import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'pathe'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { NuxtConfig } from '@nuxt/schema'

import { resolveNuxtOptions } from '../src/config/index.ts'

const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'nuxt-options-')))
const rootDir = join(tmp, 'project')
const rootDirWithoutApp = join(tmp, 'project-without-app')
mkdirSync(join(rootDir, 'app'), { recursive: true })
mkdirSync(rootDirWithoutApp, { recursive: true })

afterAll(() => rmSync(tmp, { recursive: true, force: true }))

function resolveOptions (config: NuxtConfig) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const options = resolveNuxtOptions({ rootDir, workspaceDir: rootDir, dev: false, test: false, ...config })
    const diagnostics = [...warn.mock.calls, ...error.mock.calls]
      .flatMap(call => String(call[0]).match(/NUXT_[A-Z]\d+/g) ?? [])
    return { options: normalise(options), diagnostics }
  } finally {
    warn.mockRestore()
    error.mockRestore()
  }
}

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/

function normalise (value: unknown): unknown {
  if (typeof value === 'string') {
    return UUID_RE.test(value) ? '<uuid>' : value.replaceAll(tmp, '<tmp>')
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`
  }
  if (Array.isArray(value)) {
    return value.map(normalise)
  }
  if (value && typeof value === 'object' && isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).map(([key, entry]) => [key, normalise(entry)]))
  }
  return value
}

function isPlainObject (value: object) {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function flatten (value: unknown, path = '', out: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length) {
    for (const [key, entry] of Object.entries(value)) {
      flatten(entry, path ? `${path}.${key}` : key, out)
    }
  } else {
    out[path] = value
  }
  return out
}

/** The entries of `options` that differ from `baseline`, keyed by path. */
function diff (baseline: unknown, options: unknown) {
  const before = flatten(baseline)
  const after = flatten(options)
  const changes: Record<string, unknown> = {}
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!(key in after)) {
      changes[key] = '<removed>'
    } else if (JSON.stringify(before[key]) !== JSON.stringify(after[key]) || !(key in before)) {
      changes[key] = after[key]
    }
  }
  return changes
}

const cases: Record<string, NuxtConfig> = {
  'dev': { dev: true },
  'test': { test: true },
  'ssr disabled': { ssr: false },
  'webpack builder': { builder: 'webpack' },
  'rspack builder': { builder: 'rspack' },
  'rsbuild builder': { builder: 'rsbuild' },
  'custom builder object': { builder: { bundle: async () => {} } },
  'vite server builder': { server: { builder: 'vite' } },
  'no app directory': { rootDir: rootDirWithoutApp, workspaceDir: rootDirWithoutApp },
  'custom srcDir': { srcDir: 'src' },
  'custom buildDir': { buildDir: 'build' },
  'custom serverDir and dirs': { serverDir: 'api', dir: { app: 'client', public: 'static', modules: 'mods', shared: 'common' } },
  'components disabled': { components: false },
  'components as array': { components: ['~/widgets'] },
  'components as object': { components: { global: true } },
  'pages enabled': { pages: true },
  'pages as object': { pages: { pattern: ['**/*.vue'] } },
  'devtools enabled': { devtools: { enabled: true } },
  'sourcemap enabled': { sourcemap: true },
  'sourcemap disabled': { sourcemap: false },
  'sourcemap object': { sourcemap: { client: 'hidden' } },
  'debug enabled': { debug: true },
  'debug object': { debug: { templates: true } },
  'modules with falsy entries': { modules: ['a', false, null, undefined, ['b', { c: 1 }], [undefined as never, {}]] as NuxtConfig['modules'] },
  'spaLoadingTemplate path': { spaLoadingTemplate: 'loading.html' },
  'spaLoadingTemplate enabled': { spaLoadingTemplate: true },
  'head with viewport': { app: { head: { meta: [{ name: 'viewport', content: 'width=500' }], charset: 'latin1' } } },
  'root and teleport ids disabled': { app: { rootId: false as never, teleportId: false } },
  'view transitions in app': { app: { viewTransition: true } },
  'view transitions in experimental': { experimental: { viewTransition: { enabled: 'always', types: ['slide'] } } },
  'base URL and assets dir': { app: { baseURL: '/base/', buildAssetsDir: 'assets', cdnURL: 'https://cdn.example.com' } },
  'inline styles disabled': { features: { inlineStyles: false } },
  'no scripts enabled': { features: { noScripts: true } },
  'route chunk error legacy true': { experimental: { emitRouteChunkError: true as never } },
  'route chunk error legacy reload': { experimental: { emitRouteChunkError: 'reload' as never } },
  'component islands local': { experimental: { componentIslands: 'local' } },
  'component islands local and remote': { experimental: { componentIslands: 'local+remote' } },
  'payload extraction enabled': { experimental: { payloadExtraction: true } },
  'ssr streaming enabled': { experimental: { ssrStreaming: true } },
  'nitro vite environment with webpack': { builder: 'webpack', experimental: { nitroViteEnvironment: true } },
  'prerender error pages': { experimental: { prerenderErrorPages: [404, 200, 500] } },
  'postcss order preset': { postcss: { order: 'cssnanoLast' } },
  'typescript hoist disabled': { typescript: { hoist: false as never, builder: 'vite' } },
  'tracing channel enabled': { tracingChannel: true },
  'tracing channel in nitro': { tracingChannel: { h3: false }, nitro: { tracingChannel: { srvx: false } } as never },
  'nitro legacy enabled': { nitroLegacy: true } as NuxtConfig,
  'nitro legacy object': { nitroLegacy: { h3: false } } as NuxtConfig,
  'analyze enabled': { build: { analyze: true } },
  'aliases, ignore, extensions and watch': { alias: { '#custom': '/custom' }, ignore: ['**/*.foo'], ignorePrefix: '_', extensions: ['.md'], watch: ['a', /b/] },
  'allowed hosts': { devServer: { host: 'example.com', allowedHosts: ['a.example.com'] }, vite: { server: { allowedHosts: ['b.example.com'] } } },
  'route rules and prerender': { routeRules: { '/a': { ssr: false } }, prerender: { routes: ['/a'] } as never, nitro: { routeRules: { '/b': { prerender: true } }, prerender: { crawlLinks: true } } },
  'runtime config': { runtimeConfig: { secret: null as never, public: { value: undefined as never, nested: { value: null as never } } } },
  'vue options': { vue: { compilerOptions: { comments: true }, propsDestructure: false, transformAssetUrls: { img: ['data-src'] } } },
  'vite overrides': { vite: { root: '/custom-root', mode: 'staging', define: { FOO: '1' }, optimizeDeps: { exclude: ['x'] }, build: { assetsDir: 'static' } } },
  'webpack overrides': { builder: 'webpack', webpack: { analyze: false, cssSourceMap: true, optimizeCSS: false, loaders: { scss: {} } } },
  'compatibility version 4': { future: { compatibilityVersion: 4 as never } },
  'typescript bundler resolution from tsconfig': { typescript: { tsConfig: { compilerOptions: { moduleResolution: 'node' } } } },
  'log level verbose': { logLevel: 'verbose' },
  'invalid log level': { logLevel: 'loud' as never },
  'invalid watcher': { experimental: { watcher: 'fsevents' as never } },
  'invalid booleans': { ssr: 'yes' as never, dev: 'true' as never, experimental: { typedPages: 'on' as never } },
  'invalid css entries': { css: ['~/a.css', 1 as never, { src: 'b.css' } as never] },
  'invalid vite publicDir': { vite: { publicDir: 'static' } as never },
  'unhead legacy': { unhead: { legacy: true } as never },
  'parse error data disabled': { experimental: { parseErrorData: false } },
  'unknown keys': { myModule: { option: true } } as NuxtConfig,
}

describe('options resolution', async () => {
  const baseline = await resolveOptions({})

  it('resolves defaults', () => {
    expect(baseline).toMatchSnapshot()
  })

  it.each(Object.entries(cases))('resolves %s', async (_name, config) => {
    const { options, diagnostics } = await resolveOptions(config)
    expect({ changes: diff(baseline.options, options), diagnostics }).toMatchSnapshot()
  })
})
