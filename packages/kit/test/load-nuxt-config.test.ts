import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { basename, join } from 'pathe'
import { findWorkspaceDir } from 'pkg-types'

import type { NitroConfig, Nuxt, NuxtConfig } from '@nuxt/schema'

import type { LoadNuxtConfigOptions } from '../src/loader/config.ts'
import { diffNuxtConfig, loadNuxtConfig } from '../src/loader/config.ts'
import { getLayerDirectories } from '../src/layers.ts'
import { withTempDir, writeFiles } from './utils.ts'
import type { FixtureFiles } from './utils.ts'

const repoRoot = await findWorkspaceDir()
const layerFixture = fileURLToPath(new URL('./layer-fixture', import.meta.url)).replace(/\\/g, '/')

/** A directory inside the workspace, for configs that import packages installed in the repository. */
function useWorkspaceDir (name: string, files: FixtureFiles = {}) {
  const dir = join(repoRoot, 'temp', name)
  beforeAll(async () => {
    // `symlink` throws EEXIST on leftovers from an aborted run
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await writeFiles(dir, files)
  })
  afterAll(() => rm(dir, { recursive: true, force: true }))
  return dir
}

describe('loadNuxtConfig', () => {
  it('should add named aliases for local layers', async () => {
    const config = await loadNuxtConfig({ cwd: layerFixture })
    for (const alias in config.alias) {
      config.alias[alias] = config.alias[alias]!.replace(layerFixture, '<rootDir>')
    }
    expect(config.alias).toMatchInlineSnapshot(`
      {
        "#build": "<rootDir>/.nuxt/",
        "#internal/nuxt/paths": "<rootDir>/.nuxt/paths.mjs",
        "#layers/c": "<rootDir>/layers/c/",
        "#layers/d": "<rootDir>/layers/d/",
        "#layers/layer-fixture": "<rootDir>/",
        "#server": "<rootDir>/server/",
        "#shared": "<rootDir>/shared/",
        "@": "<rootDir>/",
        "@@": "<rootDir>/",
        "~": "<rootDir>/",
        "~~": "<rootDir>/",
      }
    `)
  })

  // 1. layers in nuxt.config (first overrides second), 2. local layers in alphabetical order (Z overrides A), 3. local project overrides
  it.each<[string, NuxtConfig | undefined, string[]]>([
    ['alphabetically', undefined, ['layer-fixture', 'd', 'c', 'b', 'a']],
    ['listed in extends (alias path) above unlisted ones', { extends: ['~/layers/c'] }, ['layer-fixture', 'c', 'd', 'b', 'a']],
    ['by their position in extends (relative path)', { extends: ['./layers/c', './layers/d'] }, ['layer-fixture', 'c', 'd', 'b', 'a']],
  ])('should order local layers %s', async (_, overrides, order) => {
    const config = await loadNuxtConfig({ cwd: layerFixture, overrides })
    expect(config._layers.map(l => basename(l.cwd))).toEqual(order)
  })

  it('should preserve and resolve a custom env name', async () => {
    const config = await loadNuxtConfig({ cwd: layerFixture, envName: 'staging' })
    expect(config.envName).toBe('staging')
  })

  it('should not leak layer directory defaults into the merged Nuxt config', () => withTempDir({
    'nuxt.config.ts': 'export default defineNuxtConfig({})\n',
    'layers/foo/nuxt.config.ts': `export default defineNuxtConfig({
      future: { compatibilityVersion: 4 },
      dir: { app: 'custom-app' },
      srcDir: '.',
      imports: { scan: false },
      typescript: { strict: false },
      app: { head: { meta: [{ name: 'layer' }] } },
      experimental: { appManifest: false },
    })\n`,
  }, async (dir) => {
    const layerDir = join(dir, 'layers/foo')
    const config = await loadNuxtConfig({ cwd: dir })
    const [rootDirectories, layerDirectories] = getLayerDirectories({ options: config } as Nuxt)

    expect(config.dir.app).toBe(join(dir, 'custom-app'))
    expect(config._layers[1]?.config.dir?.app).toBe(join(layerDir, 'custom-app'))
    expect(rootDirectories?.public).toBe(`${join(dir, 'public')}/`)
    expect(layerDirectories?.public).toBe(`${join(layerDir, 'public')}/`)

    const { imports, typescript, app, experimental } = config._layers[1]!.config
    expect({ imports, typescript, app, experimental }).toEqual({
      imports: { scan: false },
      typescript: { strict: false },
      app: { head: { meta: [{ name: 'layer' }] } },
      experimental: { appManifest: false },
    })
  }))

  it.fails('should support cyclic references in build-time config', () => withTempDir({
    'nuxt.config.ts': `const api: Record<string, unknown> = {}
    const plugin = { name: 'cyclic-plugin', api }
    api.plugin = plugin

    export default defineNuxtConfig({
      vite: { plugins: [plugin] },
    })\n`,
  }, async (dir) => {
    const config = await loadNuxtConfig({ cwd: dir })
    const plugin = config.vite.plugins?.[0] as unknown as { api: { plugin: unknown } }
    expect(plugin.api.plugin).toBe(plugin)
  }))

  // jiti gives JSON imports a non-enumerable, self-referential `default` interop property
  it('should support jiti-imported JSON modules in build-time config', () => withTempDir({
    'tsconfig.base.json': { compilerOptions: { strict: true } },
    'nuxt.config.ts': `import tsConfig from './tsconfig.base.json'
    export default defineNuxtConfig({ nitro: { typescript: { tsConfig } } })\n`,
  }, async (dir) => {
    const config = await loadNuxtConfig({ cwd: dir })
    expect((config.nitro as NitroConfig).typescript?.tsConfig?.compilerOptions?.strict).toBe(true)
  }))

  it('should load a yaml `nuxt.config`', () => withTempDir({ 'nuxt.config.yaml': 'ssr: false\n' }, async (dir) => {
    const config = await loadNuxtConfig({ cwd: dir })
    expect(config.ssr).toBe(false)
  }))

  it('should apply NUXT_PORT and NUXT_HOST from .env to devServer defaults', () => withTempDir({
    '.env': 'NUXT_PORT=3005\nNUXT_HOST=0.0.0.0\n',
  }, async (dir) => {
    vi.resetModules()
    // delay c12 so the schema import wins the race (#34955)
    vi.doMock('c12', async () => {
      const actual = await vi.importActual<typeof import('c12')>('c12')
      return {
        ...actual,
        loadConfig: async (opts: Parameters<typeof actual.loadConfig>[0]) => {
          await new Promise(resolve => setTimeout(resolve, 50))
          return actual.loadConfig(opts)
        },
      }
    })

    try {
      const { loadNuxtConfig } = await import('../src/loader/config.ts')
      const config = await loadNuxtConfig({ cwd: dir })
      expect(config.devServer.port).toBe(3005)
      expect(config.devServer.host).toBe('0.0.0.0')
    } finally {
      vi.doUnmock('c12')
      delete process.env.NUXT_PORT
      delete process.env.NUXT_HOST
    }
  }))

  it('should keep typesDir at the default build directory when the build directory is relocated', () => withTempDir({ '.nuxt/.keep': '' }, async (dir) => {
    const config = await loadNuxtConfig({ cwd: dir, overrides: { dev: false } })
    expect(config.buildDir).toBe(join(dir, 'node_modules/.cache/nuxt/.nuxt'))
    expect(config.typesDir).toBe(join(dir, '.nuxt'))
  }))

  it('should default typesDir to a custom build directory', () => withTempDir({
    'nuxt.config.ts': 'export default defineNuxtConfig({ buildDir: \'build\' })\n',
  }, async (dir) => {
    const config = await loadNuxtConfig({ cwd: dir })
    expect(config.typesDir).toBe(join(dir, 'build'))
  }))

  it('should report an unsupported `future.compatibilityVersion` once', () => withTempDir({
    'nuxt.config.ts': 'export default defineNuxtConfig({ future: { compatibilityVersion: 4 } })\n',
    'layers/base/nuxt.config.ts': 'export default defineNuxtConfig({ future: { compatibilityVersion: 4 } })\n',
  }, async (dir) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const config = await loadNuxtConfig({ cwd: dir })
      expect(config.future.compatibilityVersion).toBe(5)
      expect(warn.mock.calls.filter(call => String(call[0]).includes('NUXT_B5029'))).toHaveLength(1)
    } finally {
      warn.mockRestore()
    }
  }))
})

describe('loadNuxtConfig layer deduplication', () => {
  const tempDir = useWorkspaceDir('layer-dedup', {
    'layers/base/nuxt.config.ts': 'export default defineNuxtConfig({ css: [\'base-marker.css\'] })',
    'real-layer/nuxt.config.ts': 'export default defineNuxtConfig({ css: [\'real-marker.css\'] })',
  })

  beforeAll(async () => {
    // `junction` so this also works on Windows CI without elevated permissions
    await symlink(join(tempDir, 'real-layer'), join(tempDir, 'layers', 'linked'), 'junction')
  })

  async function load (extendsLayers: string[]) {
    await writeFile(join(tempDir, 'nuxt.config.ts'), `export default defineNuxtConfig({ extends: ${JSON.stringify(extendsLayers)} })`)
    return loadNuxtConfig({ cwd: tempDir })
  }

  const count = (css: string[] | undefined, marker: string) => css?.filter(entry => entry === marker).length

  it('does not merge a layer twice when auto-scanned and also in `extends` (#34667)', async () => {
    expect(count((await load(['./layers/base'])).css, 'base-marker.css')).toBe(1)
  })

  it('still auto-scans a `layers/` layer without an explicit `extends`', async () => {
    expect(count((await load([])).css, 'base-marker.css')).toBe(1)
  })

  it('dedupes a layer extended via a symlink and via its real path', async () => {
    expect(count((await load(['./layers/linked', './real-layer'])).css, 'real-marker.css')).toBe(1)
  })

  it('addresses a layer extended via a symlink by its real path', async () => {
    const config = await load(['./layers/linked'])
    const layer = config._layers.find(layer => layer.config.css?.includes('real-marker.css'))
    expect(layer?.cwd).toBe(join(tempDir, 'real-layer'))
    expect(layer?.config.rootDir).toBe(join(tempDir, 'real-layer'))
    expect(layer?.config.srcDir).toBe(join(tempDir, 'real-layer'))
    expect(layer?.configFile).toBe(join(tempDir, 'real-layer/nuxt.config.ts'))
    expect(config._layers[0]?.cwd).toBe(tempDir)
  })

  it('dedupes a layer extended via its config file path and auto-scanned as a dir', async () => {
    // c12 resolves the config-file fallback path relative to `process.cwd()`, so the file-path
    // spelling only loads when the process cwd is the project root, as in a real `nuxt dev`
    const originalCwd = process.cwd()
    process.chdir(tempDir)
    try {
      expect(count((await load(['./layers/base/nuxt.config.ts'])).css, 'base-marker.css')).toBe(1)
    } finally {
      process.chdir(originalCwd)
    }
  })
})

describe('loadNuxtConfig onConfigResolved', () => {
  const tempDir = useWorkspaceDir('config-resolved')

  async function loadRawConfig (source: string, options: Omit<LoadNuxtConfigOptions, 'cwd' | 'onConfigResolved'> = {}) {
    await writeFile(join(tempDir, 'nuxt.config.ts'), `export default defineNuxtConfig(${source})`)
    const snapshots: NuxtConfig[] = []
    const config = await loadNuxtConfig({ cwd: tempDir, ...options, onConfigResolved: ctx => void snapshots.push(ctx.rawConfig) })
    expect(snapshots).toHaveLength(1)
    return { raw: snapshots[0]!, config }
  }

  async function diff (before: string, after: string) {
    return diffNuxtConfig((await loadRawConfig(before)).raw, (await loadRawConfig(after)).raw)
  }

  it('should receive the merged config before defaults are applied', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({ ssr: false, modules: [] })')
    const onConfigResolved = vi.fn()
    await loadNuxtConfig({ cwd: tempDir, onConfigResolved })

    expect(onConfigResolved).toHaveBeenCalledOnce()
    const [context] = onConfigResolved.mock.calls[0]!
    expect(context.rawConfig).toMatchObject({ ssr: false, modules: [] })
    expect(context.cwd).toBe(tempDir)
    expect(context.configFile).toBe(join(tempDir, 'nuxt.config.ts'))
    expect(context.layers.length).toBeGreaterThan(0)
  })

  it('should provide snapshots that can be diffed between loads', async () => {
    const entries = await diff('{ ssr: true, telemetry: false }', '{ ssr: false, telemetry: false, modules: [\'a\'] }')
    expect(entries.map(entry => entry.label).sort()).toEqual(['modules', 'ssr'])
    expect(entries.find(entry => entry.label === 'ssr')).toMatchObject({ type: 'changed', oldValue: true, newValue: false })
  })

  it('should report a structured path for keys containing a dot', async () => {
    const entries = await diff(
      '{ nitro: { routeRules: { \'/index.html\': { ssr: true } } } }',
      '{ nitro: { routeRules: { \'/index.html\': { ssr: false } } } }',
    )
    expect(entries).toMatchObject([{
      path: ['nitro', 'routeRules', '/index.html', 'ssr'],
      label: 'nitro.routeRules["/index.html"].ssr',
      type: 'changed',
      oldValue: true,
      newValue: false,
    }])
  })

  it('should produce a parseable label for keys containing quotes and line terminators', async () => {
    const entries = await diff(
      '{ vite: { define: { \'a\\nb\': 1, \'it\\\'s\': 1, \'back\\\\slash\': 1 } } }',
      '{ vite: { define: { \'a\\nb\': 2, \'it\\\'s\': 2, \'back\\\\slash\': 2 } } }',
    )
    expect(entries).toHaveLength(3)
    for (const entry of entries) {
      expect(() => new Function(`return (config) => config.${entry.label}`)).not.toThrow()
    }
    expect(entries.map(entry => entry.label)).toContain('vite.define["a\\nb"]')
  })

  it('should exclude `overrides` and `defaults` supplied by the caller', async () => {
    const { raw: baseline } = await loadRawConfig('{ ssr: true }')
    const { raw: withExtras } = await loadRawConfig('{ ssr: true }', {
      overrides: { dev: true },
      defaults: { devServer: { cors: { origin: ['http://localhost:3000'] } } },
    })

    expect(diffNuxtConfig(baseline, withExtras)).toEqual([])
    expect(withExtras).not.toHaveProperty('dev')
    expect(withExtras).not.toHaveProperty('devServer')
  })

  it('should not report changes for functions and other non-plain values in an unchanged config', async () => {
    const source = `{
      hooks: { 'build:done': () => 'noop' },
      modules: [{ setup () {} }],
      ignore: [/^ignored/.source],
      vite: { define: { WHEN: new Date(0).toISOString() } },
    }`
    expect(await diff(source, source)).toEqual([])
  })

  it('should fire once with `extends` layers', async () => {
    await writeFiles(tempDir, { 'layers/base/nuxt.config.ts': 'export default defineNuxtConfig({ css: [\'base.css\'] })' })
    const { raw, config } = await loadRawConfig('{ extends: [\'./layers/base\'], css: [\'app.css\'] }')
    expect(raw.css).toEqual(config.css)
    await rm(join(tempDir, 'layers'), { recursive: true, force: true })
  })

  it('should not fire when config loading throws', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'throw new Error(\'broken config\')')
    const onConfigResolved = vi.fn()
    await expect(loadNuxtConfig({ cwd: tempDir, onConfigResolved })).rejects.toThrow()
    expect(onConfigResolved).not.toHaveBeenCalled()
  })

  it('should be awaited before resolving', async () => {
    await writeFile(join(tempDir, 'nuxt.config.ts'), 'export default defineNuxtConfig({})')
    let done = false
    await loadNuxtConfig({
      cwd: tempDir,
      onConfigResolved: async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
        done = true
      },
    })
    expect(done).toBe(true)
  })
})

describe('loadNuxtConfig runtime config schemas', () => {
  const tempDir = useWorkspaceDir('runtime-config-schemas', {
    'layers/base/nuxt.config.ts': `import { z } from 'zod'
export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: z.string(),
    session: z.object({ name: z.string(), secure: z.boolean().default(true) }),
    public: { mode: z.enum(['a', 'b']).default('a'), limit: z.number().nullable().default(null) },
  },
})`,
    'nuxt.config.ts': `export default defineNuxtConfig({ runtimeConfig: { session: { name: 'user' }, public: { mode: 'b' } } })`,
  })

  it('replaces schemas from layers with their defaults, merged with values from higher layers', async () => {
    const config = await loadNuxtConfig({ cwd: tempDir })
    expect(config.runtimeConfig).not.toHaveProperty('apiSecret')
    expect(config.runtimeConfig.session).toEqual({ name: 'user', secure: true })
    expect(config.runtimeConfig.public).toEqual({ mode: 'b', limit: null })
    expect((config.nitro as NitroConfig).runtimeConfig!.public).toEqual({ mode: 'b', limit: null })
    expect(config._runtimeConfigSchemas!.map(entry => [entry.path.join('.'), entry.required])).toEqual([
      ['apiSecret', true],
      ['session', false],
      ['public.mode', false],
      ['public.limit', false],
    ])
  })
})
