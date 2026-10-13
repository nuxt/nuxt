import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitro/types'

import { createHooks } from 'hookable'
import { createUnimport } from 'unimport'
import { resolveModulePath } from 'exsolve'

import { getLegacyRuntimeConfigPath, getNitroPackageResolutions, getServerImportsPresets, resolveNitroLegacyOptions, scanLegacyScope, setupNitroCompat } from '../src/compat.ts'
import { getH3ImportsPreset, nuxtServerImportsPreset, v2ImportsPreset } from '../src/imports.ts'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
import { kServerApi } from '@nuxt/kit/internal'
import { H3 } from 'nitro/h3'

/** An entry as `addServerHandler()` leaves it, having resolved the variant it registered. */
function declared<T extends object> (entry: T, api: string): any {
  return Object.defineProperty(entry, kServerApi, { value: api, configurable: true })
}

function createNuxt (options: Record<string, any> = {}) {
  return {
    options: {
      alias: {},
      rootDir: '/project',
      srcDir: '/project',
      serverDir: '/project/server',
      buildDir: '/project/.nuxt',
      dir: { shared: 'shared', public: 'public' },
      devServerHandlers: [],
      experimental: {},
      vite: {},
      nitro: {},
      _layers: [{ config: { rootDir: '/project', srcDir: '/project' }, cwd: '/project' }],
      ...options,
    },
  } as unknown as Nuxt
}

function createLateNitro (nitroConfig: NitroConfig) {
  return { options: { alias: {}, plugins: nitroConfig.plugins, handlers: nitroConfig.handlers }, hooks: createHooks() } as any
}

describe('getNitroPackageResolutions', () => {
  it('maps nitro subpaths to the copy this package resolved', () => {
    const resolutions = getNitroPackageResolutions()

    expect(resolutions['nitro/h3']).toMatch(/nitro/)
    expect(resolutions['nitro/cache']).toMatch(/nitro/)
    // builder-only entries must not become bundleable
    expect(resolutions['nitro/builder']).toBeUndefined()
    expect(resolutions['nitro/vite']).toBeUndefined()
  })
})

describe('resolveNitroLegacyOptions', () => {
  it('is disabled by default', () => {
    expect(resolveNitroLegacyOptions(undefined)).toEqual({
      imports: false,
      h3: false,
      specifiers: false,
      runtimeConfig: false,
      config: false,
    })
    expect(resolveNitroLegacyOptions(false).h3).toBe(false)
  })

  it('enables every toggle with `true`', () => {
    expect(Object.values(resolveNitroLegacyOptions(true)).every(Boolean)).toBe(true)
  })

  it('enables everything not explicitly disabled', () => {
    expect(resolveNitroLegacyOptions({ h3: false })).toMatchObject({ h3: false, specifiers: true, imports: true })
  })
})

describe('setupNitroCompat', () => {
  const legacyOff = resolveNitroLegacyOptions(false)

  function createModuleDir (prefix: string, symlinked: boolean) {
    const root = mkdtempSync(join(tmpdir(), prefix))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    const target = join(root, 'module')
    mkdirSync(target)
    if (!symlinked) {
      return target
    }
    const dir = join(root, 'linked-module')
    symlinkSync(realpathSync(target), dir, 'junction')
    return dir
  }

  it('keeps the nitro package out of the v2 scope', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const manifest = resolveModulePath('nitro/package.json', { from: import.meta.url })
    // nitro v3 dev routes import bare `h3`, which resolves to h3 v2 for them
    const nitroRoute = join(dirname(manifest), 'dist/runtime/internal/routes/scalar.mjs')
    expect(readFileSync(nitroRoute, 'utf8')).toContain(`from "h3"`)
    expect(scanLegacyScope([nitroRoute], []).size).toBe(1)

    const nitroConfig: NitroConfig = {
      handlers: [{ route: '/_scalar', handler: nitroRoute } as any],
    }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(report).not.toHaveBeenCalled()
    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }
    await expect(plugin.resolveId.handler.call(context, 'h3', nitroRoute)).resolves.toBeUndefined()
    report.mockRestore()
  })

  it('wraps v2-tagged handlers and hides the compatibility tag', async () => {
    const nitroConfig: NitroConfig = {
      handlers: [
        declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2'),
        declared({ route: '/v3', handler: '/modules/v3.ts' }, 'nitro3'),
        { route: '/untagged', handler: '/modules/untagged.ts' },
      ],
    }

    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9004').mockImplementation(() => ({}) as any)
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(nitroConfig.handlers![0]).toEqual({ route: '/v2', handler: '#nuxt-compat/handler-0' })
    expect(nitroConfig.handlers![1]).toEqual({ route: '/v3', handler: '/modules/v3.ts' })
    expect(nitroConfig.handlers![2]).toEqual({ route: '/untagged', handler: '/modules/untagged.ts' })

    const virtual = (nitroConfig.virtual!['#nuxt-compat/handler-0'] as () => string)()
    expect(virtual).toContain('wrapLegacyHandler')
    expect(virtual).toContain('/modules/handler.ts')
    vi.restoreAllMocks()
  })

  it('gives a v2 middleware handler without a route a v3 route', async () => {
    const nitroConfig: NitroConfig = {
      handlers: [declared({ handler: '/modules/middleware.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(nitroConfig.handlers![0]).toMatchObject({ route: '/**', middleware: true })
  })

  it('registers route-less portable and nitro v3 handlers as global middleware without reporting them', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    const handlers = [
      declared({ handler: '/modules/cors.ts' }, 'nuxt'),
      declared({ handler: '/modules/xss.ts' }, 'nuxt'),
      declared({ handler: '/modules/v3.ts' }, 'nitro3'),
      declared({ route: '/api', handler: '/modules/api.ts' }, 'nuxt'),
    ]
    const nitroConfig: NitroConfig = { handlers }
    const registerLate = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])
    await registerLate({ options: { handlers, devHandlers: [], plugins: [], virtual: {} }, hooks: createHooks() } as any)

    expect(handlers.slice(0, 3).every(h => h.route === '/**' && h.middleware === true)).toBe(true)
    expect(handlers[3]).toMatchObject({ route: '/api' })
    expect(handlers[3]).not.toHaveProperty('middleware')
    expect(report).not.toHaveBeenCalled()
    report.mockRestore()
  })

  it('reports route-less v2 handlers once for the whole build', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    const nitroConfig: NitroConfig = {
      handlers: [
        declared({ handler: '/modules/a.ts' }, 'nitro2'),
        declared({ handler: '/modules/b.ts' }, 'nitro2'),
      ],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 2 })
    report.mockRestore()
  })

  it('maps h3 v1 and nitro v2 specifiers for a declared v2 entry', async () => {
    const nitroConfig: NitroConfig = {
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }
    await expect(plugin.resolveId.handler.call(context, 'h3', '/modules/handler.ts')).resolves.toMatch(/compat[\\/]h3-v1/)
    await expect(plugin.resolveId.handler.call(context, 'nitropack/runtime', '/modules/handler.ts')).resolves.toMatch(/compat[\\/]nitro-v2/)
    await expect(plugin.resolveId.handler.call(context, '#internal/nitro', '/modules/handler.ts')).resolves.toMatch(/compat[\\/]nitro-v2/)
    await expect(plugin.resolveId.handler.call(context, 'h3', '/other/handler.ts')).resolves.toBeUndefined()
    await expect(plugin.resolveId.handler.call(context, 'ofetch', '/modules/handler.ts')).resolves.toBeUndefined()
  })

  it('resolves nitro and its implicit dependencies for an importer that cannot reach them, on both server build paths', async () => {
    const nuxt = createNuxt({ experimental: { nitroViteEnvironment: true } })
    const nitroConfig: NitroConfig = { handlers: [] }
    await setupNitroCompat(nuxt, nitroConfig, legacyOff, [])

    const vitePlugins = nuxt.options.vite.plugins as any[]
    for (const resolvers of [
      nitroConfig.rollupConfig!.plugins as any[],
      vitePlugins.filter(plugin => plugin.applyToEnvironment?.({ name: 'nitro' })),
    ]) {
      // rolldown asks more than once per specifier, answering a `this.resolve` probe with
      // whatever an earlier call resolved
      let cached: string | undefined
      const context = { resolve: () => Promise.resolve(cached ? { id: cached } : null) }
      const resolveId = async (source: string) => {
        for (const plugin of resolvers) {
          const filter = plugin.resolveId?.filter?.id
          if (filter && !filter.test(source)) { continue }
          const id = await plugin.resolveId?.handler?.call(context, source, '/project/.nuxt/paths.mjs')
          if (id) {
            cached = id
            return id
          }
        }
      }

      await expect(resolveId('nitro/runtime-config')).resolves.toMatch(/runtime-config/)
      await expect(resolveId('nitro/runtime-config')).resolves.toMatch(/runtime-config/)
      for (const [source, pkg] of [['nitro', 'nitro'], ['h3', 'h3'], ['h3/rules', 'h3'], ['srvx', 'srvx'], ['defu', 'defu'], ['consola', 'consola'], ['ofetch', 'ofetch'], ['crossws', 'crossws']]) {
        await expect(resolveId(source!), source).resolves.toMatch(new RegExp(`[\\\\/]${pkg}[\\\\/]`))
      }
      // builder-only nitro subpaths must not become bundleable
      await expect(resolveId('nitro/builder')).resolves.toBeUndefined()
      await expect(resolveId('nitro/vite')).resolves.toBeUndefined()
      await expect(resolveId('nitropack/runtime')).resolves.toBeUndefined()
      await expect(resolveId('h3x')).resolves.toBeUndefined()

      const fallback = resolvers.find(plugin => plugin.name === 'nuxt:nitro-resolve-fallback')
      expect([fallback.enforce, fallback.resolveId.order]).toEqual(['post', 'post'])
    }

    expect(vitePlugins.filter(plugin => plugin.applyToEnvironment?.({ name: 'client' }))).toEqual([])
  })

  it('resolves nitro for a virtual importer', async () => {
    const nitroConfig: NitroConfig = { handlers: [] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const resolvable = { resolve: () => Promise.resolve({ id: '/project/node_modules/hoisted-nitro.mjs' }) }

    for (const importer of ['#internal/nuxt/paths', '\0virtual:#internal/nuxt/paths']) {
      await expect(plugin.resolveId.handler.call(resolvable, 'nitro/runtime-config', importer)).resolves.toBe(getNitroPackageResolutions()['nitro/runtime-config'])
    }
    await expect(plugin.resolveId.handler.call(resolvable, 'nitro/builder', '#internal/nuxt/paths')).resolves.toBeUndefined()
  })

  it('rewrites specifiers in scoped source', async () => {
    const nitroConfig: NitroConfig = {
      imports: {},
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [
      { from: 'nitro/storage', imports: ['useStorage'] },
      { from: 'nitro', imports: [{ name: 'definePlugin', as: 'defineNitroPlugin' }] },
    ])

    const barrel = nitroConfig.virtual!['#nuxt-compat/imports'] as string
    expect(barrel).toContain(`export * from '#imports'`)
    expect(barrel).toContain(`export { useStorage } from "nitro/storage"`)
    expect(barrel).toContain(`export { definePlugin as defineNitroPlugin } from "nitro"`)

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const result = await plugin.transform.handler.call(null,
      `import { useRuntimeConfig } from '#imports'\nimport { getQuery } from 'h3'\nconst m = await import("nitropack/runtime")\n`,
      '/modules/handler.ts',
    )

    expect(result.code).toContain(`from '#nuxt-compat/imports'`)
    expect(result.code).toMatch(/from '[^']*compat[\\/]h3-v1/)
    expect(result.code).toMatch(/import\("[^"]*compat[\\/]nitro-v2/)
    await expect(plugin.transform.handler.call(null, `import { getQuery } from 'h3'`, '/other/handler.ts')).resolves.toBeUndefined()
  })

  it('keeps module-local imports of a tagged entry in scope', async () => {
    const nitroConfig: NitroConfig = {
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve({ id: '/modules/utils.ts' }) }

    await plugin.resolveId.handler.call(context, './utils', '/modules/handler.ts')

    await expect(plugin.resolveId.handler.call(context, 'h3', '/modules/utils.ts')).resolves.toMatch(/compat[\\/]h3-v1/)
  })

  it('wins the legacy `useRuntimeConfig` binding whichever pass runs first', async () => {
    const nitroConfig: NitroConfig = {
      imports: {},
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [
      { from: getLegacyRuntimeConfigPath(), imports: ['useRuntimeConfig'] },
    ])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const code = `export default defineEventHandler(event => useRuntimeConfig(event).public)`
    const ours = await plugin.transform.handler.call(null, code, '/modules/handler.ts')

    expect(ours.code).toMatch(/import \{[^}]*useRuntimeConfig[^}]*\} from ['"][^'"]*compat[\\/]runtime-config/)

    const nitroPass = createUnimport({ presets: [{ from: 'nitro/runtime-config', imports: ['useRuntimeConfig'] }] })
    await nitroPass.init()
    const after = await nitroPass.injectImports(ours.code, '/modules/handler.ts')

    expect(after.imports.map(i => i.name)).not.toContain('useRuntimeConfig')
    expect(after.code.toString()).not.toContain('nitro/runtime-config')

    // the reverse order cannot be repaired after the fact, which is why the plugin
    // declares `order` and `enforce` for both build paths
    const nitroFirst = await nitroPass.injectImports(code, '/modules/handler.ts')
    const oursSecond = await plugin.transform.handler.call(null, nitroFirst.code.toString(), '/modules/handler.ts')
    expect(oursSecond?.code ?? nitroFirst.code.toString()).toContain('nitro/runtime-config')
  })

  it('leaves code that has migrated to nitro v3 alone', async () => {
    const nitroConfig: NitroConfig = {
      imports: {},
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [{ from: getLegacyRuntimeConfigPath(), imports: ['useRuntimeConfig'] }])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const migrated = await plugin.transform.handler.call(null, [
      `import { defineHandler } from 'nitro/h3'`,
      `import { getQuery } from 'h3'`,
      `import '#imports'`,
      `export default defineHandler(event => useRuntimeConfig().public && getQuery(event))`,
    ].join('\n'), '/modules/handler.ts')

    expect(migrated.code).toContain(`'#nuxt-compat/imports'`)
    expect(migrated.code).toContain(`from 'h3'`)
    expect(migrated.code).not.toMatch(/compat[\\/]h3-v1/)
    expect(migrated.code).not.toMatch(/compat[\\/]runtime-config/)

    const notMigrated = await plugin.transform.handler.call(null, `import { getQuery } from 'h3'`, '/modules/other.ts')
    expect(notMigrated.code).toMatch(/compat[\\/]h3-v1/)
  })

  it('leaves code written against `nuxt/server` alone', async () => {
    const nitroConfig: NitroConfig = {
      imports: {},
      handlers: [{ route: '/portable', handler: '/modules/portable.ts' } as any],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [{ from: 'nitro/storage', imports: ['useStorage'] }])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const portable = await plugin.transform.handler.call(null, [
      `import { defineEventHandler, createError } from 'nuxt/server'`,
      `export default defineEventHandler(() => { throw createError({ status: 418 }) })`,
    ].join('\n'), '/modules/portable.ts')

    expect(portable?.code ?? '').not.toMatch(/compat[\\/]h3-v1/)
    expect(portable?.code ?? '').not.toContain('useStorage')
  })

  it('classifies migration from imports only, not from comments or strings', async () => {
    const nitroConfig: NitroConfig = {
      imports: {},
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const result = await plugin.transform.handler.call(null, [
      `// TODO: migrate this to import from 'nitro/h3'`,
      `/** Replaces \`import x from 'nitro/app'\` */`,
      `const hint = "import from 'nitro' instead of h3"`,
      `import { defineEventHandler } from 'h3'`,
      `export default defineEventHandler(() => 'ok')`,
    ].join('\n'), '/modules/handler.ts')

    expect(result.code).toMatch(/import \{ defineEventHandler \} from '[^']*compat[\\/]h3-v1/)
    expect(result.code).toContain(`// TODO: migrate this to import from 'nitro/h3'`)
    expect(result.code).toContain(`const hint = "import from 'nitro' instead of h3"`)
  })

  it('does not rewrite specifiers inside comments or strings', async () => {
    const nitroConfig: NitroConfig = {
      handlers: [declared({ route: '/v2', handler: '/modules/handler.ts' }, 'nitro2')],
    }

    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const result = await plugin.transform.handler.call(null, [
      `// migrated from 'h3'`,
      `/* import { x } from 'nitropack/runtime' */`,
      `const hint = "import 'h3' directly"`,
      `import { getQuery } from 'h3'`,
    ].join('\n'), '/modules/handler.ts')

    expect(result.code).toContain(`// migrated from 'h3'`)
    expect(result.code).toContain(`/* import { x } from 'nitropack/runtime' */`)
    expect(result.code).toContain(`const hint = "import 'h3' directly"`)
    expect(result.code).toMatch(/import \{ getQuery \} from '[^']*compat[\\/]h3-v1/)
  })

  it('installs nothing when the scope holds no nitro v2 code', async () => {
    const nitroConfig: NitroConfig = { handlers: [{ route: '/portable', handler: '/modules/portable/handler.ts' } as any] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])
    expect(nitroConfig.plugins).toEqual([])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }
    await expect(plugin.resolveId.handler.call(context, 'h3', '/modules/portable/handler.ts')).resolves.toBeUndefined()
    expect(nitroConfig.virtual!['#nuxt-compat/flags']).toBeTypeOf('function')
    expect((nitroConfig.virtual!['#nuxt-compat/flags'] as () => string)()).toContain('legacyCompat = false')
  })

  it.each([false, true])('installs the runtime plugin and reports the module once a scoped file imports h3 v1 (symlinked: %s)', async (symlinked) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = createModuleDir('nitro-compat-module-', symlinked)
    writeFileSync(join(dir, 'handler.ts'), `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => 'legacy')`)

    const nitroConfig: NitroConfig = { handlers: [{ route: '/legacy', handler: join(dir, 'handler.ts') } as any] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [], [{ dir, name: 'legacy-module' }])

    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
    expect((nitroConfig.virtual!['#nuxt-compat/flags'] as () => string)()).toContain('legacyCompat = true')
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`legacy-module` (imports `h3`)') })
    report.mockRestore()
  })

  it('installs the hooks bridge with the layer, which no option gates', async () => {
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-hooks-'))
    writeFileSync(join(dir, 'plugin.ts'), `import { defineNitroPlugin } from 'nitropack/runtime'\nexport default defineNitroPlugin(() => {})`)

    const nitroConfig: NitroConfig = { handlers: [{ route: '/legacy', handler: join(dir, 'plugin.ts') } as any] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(nitroConfig.plugins!.map(String)).toContainEqual(expect.stringMatching(/compat[\\/]hooks-plugin/))
    vi.restoreAllMocks()
  })

  it('does not count a variant the builder did not pick as v2 code', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-variants-'))
    mkdirSync(join(dir, 'runtime'), { recursive: true })
    const v2 = join(dir, 'runtime/handler.v2.ts')
    writeFileSync(v2, `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => 'v2')`)
    writeFileSync(join(dir, 'runtime/handler.v3.ts'), `import { defineHandler } from 'nitro/h3'\nexport default defineHandler(() => 'v3')`)

    const nitroConfig: NitroConfig = { handlers: [declared({ route: '/test', handler: join(dir, 'runtime/handler.v3.ts') }, 'nitro3')] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [], [{ dir, name: 'variants-module' }], [v2])

    expect(nitroConfig.plugins).toEqual([])
    expect((nitroConfig.virtual!['#nuxt-compat/flags'] as () => string)()).toContain('legacyCompat = false')
    expect(report).not.toHaveBeenCalled()
    report.mockRestore()
  })

  it('scopes a handler registered through a server-only alias', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-alias-'))
    writeFileSync(join(dir, 'handler.ts'), `import { getQuery } from 'h3'\nexport default (event: any) => getQuery(event)`)

    const nitroConfig: NitroConfig = {
      alias: { '#aliased-module': dir },
      handlers: [{ route: '/aliased', handler: '#aliased-module/handler.ts' } as any],
    }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }
    await expect(plugin.resolveId.handler.call(context, 'h3', join(dir, 'handler.ts'))).resolves.toMatch(/compat[\\/]h3-v1/)
    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
  })

  it('scopes and scans a virtual handler and a server template', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const nitroConfig: NitroConfig = {
      virtual: {
        '#virtual-module/handler': () => Promise.resolve(`import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => 'virtual')`),
        '#virtual-module/template': `export { useStorage } from 'nitropack/runtime'`,
        '#internal/nuxt/own': `import { createError } from 'h3'`,
      },
      handlers: [{ route: '/virtual', handler: '#virtual-module/handler' } as any],
    }
    const registerLateScope = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const transformed = await plugin.transform.handler.call(null, `import { useStorage } from 'nitropack/runtime'`, '#virtual-module/template')
    expect(transformed.code).toMatch(/compat[\\/]nitro-v2/)
    expect(await plugin.transform.handler.call(null, `import { createError } from 'h3'`, '#internal/nuxt/own')).toBeUndefined()

    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`#virtual-module/template` (imports `nitropack/runtime`)') })

    const nitro = createLateNitro(nitroConfig)
    registerLateScope(nitro)
    await nitro.hooks.callHook('build:before', nitro)

    expect(report.mock.calls[1]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`#virtual-module/handler` (imports `h3`)') })
    report.mockRestore()
  })

  it('does not wait on a virtual template that needs the nitro instance', async () => {
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    let nitroReady: () => void
    const nitroExists = new Promise<void>((resolve) => { nitroReady = resolve })
    const nitroConfig: NitroConfig = {
      virtual: {
        '#virtual-module/late': async () => {
          await nitroExists
          return `import { useStorage } from 'nitropack/runtime'`
        },
      },
      handlers: [{ route: '/late', handler: '#virtual-module/late' } as any],
    }

    const registerLateScope = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const nitro = createLateNitro(nitroConfig)
    registerLateScope(nitro)
    nitroReady!()
    await nitro.hooks.callHook('build:before', nitro)

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const transformed = await plugin.transform.handler.call(null, `import { useStorage } from 'nitropack/runtime'`, '#virtual-module/late')
    expect(transformed.code).toMatch(/compat[\\/]nitro-v2/)
    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
    vi.restoreAllMocks()
  })

  it('renders virtual templates after `nitro:init` hooks have returned', async () => {
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    let pagesResolved!: () => void
    const pages = new Promise<void>((resolve) => { pagesResolved = resolve })
    const template = vi.fn(async () => {
      await pages
      return `import { useStorage } from 'nitropack/runtime'`
    })
    const nitroConfig: NitroConfig = {
      virtual: { '#virtual-module/pages': template },
      handlers: [{ route: '/pages', handler: '#virtual-module/pages' } as any],
    }
    const registerLateScope = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const nitro = createLateNitro(nitroConfig)
    await registerLateScope(nitro)

    pagesResolved()
    await nitro.hooks.callHook('build:before', nitro)
    expect(template).toHaveBeenCalledTimes(1)
    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const transformed = await plugin.transform.handler.call(null, `import { useStorage } from 'nitropack/runtime'`, '#virtual-module/pages')
    expect(transformed.code).toMatch(/compat[\\/]nitro-v2/)
    vi.restoreAllMocks()
  })

  it('does not attribute app-side module files the server build never sees', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-app-side-'))
    mkdirSync(join(dir, 'dist/runtime/server'), { recursive: true })
    mkdirSync(join(dir, 'dist/runtime/app'), { recursive: true })
    writeFileSync(join(dir, 'dist/runtime/server/handler.ts'), `import { defineEventHandler } from 'nuxt/server'
export default defineEventHandler(() => 'ok')`)
    writeFileSync(join(dir, 'dist/runtime/app/composable.ts'), `import { setHeader } from 'h3'
export const useRule = (event: any) => setHeader(event, 'x-rule', 'noindex')`)

    const nitroConfig: NitroConfig = { handlers: [{ route: '/server', handler: join(dir, 'dist/runtime/server/handler.ts') } as any] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [], [{ dir, name: 'app-side-module' }])

    expect(report).not.toHaveBeenCalled()
    expect(nitroConfig.plugins).toEqual([])
    vi.restoreAllMocks()
  })

  it.each([false, true])('attributes module files the server build reaches through an import (symlinked: %s)', async (symlinked) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = createModuleDir('nitro-compat-reachable-', symlinked)
    mkdirSync(join(dir, 'dist/runtime/server'), { recursive: true })
    writeFileSync(join(dir, 'dist/runtime/server/handler.ts'), `import { useRule } from './rule'
export default () => useRule()`)
    writeFileSync(join(dir, 'dist/runtime/server/rule.ts'), `import { setHeader } from 'h3'
export const useRule = () => setHeader`)

    const nitroConfig: NitroConfig = { handlers: [{ route: '/server', handler: join(dir, 'dist/runtime/server/handler.ts') } as any] }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [], [{ dir, name: 'reachable-module' }])

    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`reachable-module` (imports `h3`)') })
    vi.restoreAllMocks()
  })

  it.each(['linked', 'real'])('attributes files of a symlinked module nested in another module to the nested module (registered: %s)', async (registered) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'nitro-compat-nested-')))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    const parent = join(root, 'parent')
    const child = join(parent, 'child')
    mkdirSync(join(child, 'dist/runtime/server'), { recursive: true })
    const linked = join(root, 'linked-child')
    symlinkSync(child, linked, 'junction')
    writeFileSync(join(child, 'dist/runtime/server/handler.ts'), `import { defineEventHandler } from 'h3'
import { useRule } from './rule'
export default defineEventHandler(() => useRule())`)
    writeFileSync(join(child, 'dist/runtime/server/rule.ts'), `import { setHeader } from 'h3/utils'
export const useRule = () => setHeader`)

    const handlerDir = registered === 'linked' ? linked : child
    const nitroConfig: NitroConfig = { handlers: [{ route: '/server', handler: join(handlerDir, 'dist/runtime/server/handler.ts') } as any] }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [], [{ dir: parent, name: 'parent-module' }, { dir: linked, name: 'child-module' }])

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toEqual({ count: 1, modules: '`child-module` (imports `h3`, `h3/utils`)' })
    vi.restoreAllMocks()
  })

  it.each([
    ['outside any module', undefined, 'linking-module'],
    ['inside another module', 'owning-module', 'owning-module'],
  ])('attributes module files linked from %s to the module holding their real path, else the linking module', async (_, owner, expected) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'nitro-compat-linked-out-')))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    const linking = join(root, 'linking')
    const target = join(root, 'target')
    mkdirSync(join(target, 'dist/runtime/server'), { recursive: true })
    mkdirSync(join(linking, 'dist/runtime'), { recursive: true })
    symlinkSync(join(target, 'dist/runtime/server'), join(linking, 'dist/runtime/server'), 'junction')
    writeFileSync(join(target, 'dist/runtime/server/handler.ts'), `import { defineEventHandler } from 'h3'
import { useRule } from './rule'
export default defineEventHandler(() => useRule())`)
    writeFileSync(join(target, 'dist/runtime/server/rule.ts'), `import { setHeader } from 'h3/utils'
export const useRule = () => setHeader`)

    const modules = [{ dir: linking, name: 'linking-module' }, ...owner ? [{ dir: target, name: owner }] : []]
    const nitroConfig: NitroConfig = { handlers: [{ route: '/server', handler: join(linking, 'dist/runtime/server/handler.ts') } as any] }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [], modules)

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toEqual({ count: 1, modules: `\`${expected}\` (imports \`h3\`, \`h3/utils\`)` })
    vi.restoreAllMocks()
  })

  it('does not report a v2 user server handler registered through a symlinked project directory', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9005').mockImplementation(() => ({}) as any)
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'nitro-compat-linked-user-')))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    const project = join(root, 'project')
    mkdirSync(join(project, 'server/api'), { recursive: true })
    const rootDir = join(root, 'linked-project')
    symlinkSync(project, rootDir, 'junction')
    writeFileSync(join(project, 'server/api/legacy.ts'), `import { defineEventHandler } from 'h3'
export default defineEventHandler(() => 'legacy')`)

    const nitroConfig: NitroConfig = { handlers: [declared({ route: '/api/legacy', handler: join(rootDir, 'server/api/legacy.ts') }, 'nitro2')] }
    const nuxt = createNuxt({ extensions: ['.js', '.mjs', '.ts'], rootDir, srcDir: rootDir, serverDir: join(rootDir, 'server'), buildDir: join(rootDir, '.nuxt'), _layers: [{ config: { rootDir, srcDir: rootDir }, cwd: rootDir }] })
    await setupNitroCompat(nuxt, nitroConfig, legacyOff, [], [])

    expect(report).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('does not follow or count type-only imports from a reached file', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-type-only-'))
    mkdirSync(join(dir, 'dist/runtime/server'), { recursive: true })
    mkdirSync(join(dir, 'dist/runtime/composables'), { recursive: true })
    writeFileSync(join(dir, 'dist/runtime/server/handler.ts'), `import { defineEventHandler } from 'nuxt/server'
import { helper } from './helpers'
export default defineEventHandler(() => helper())`)
    writeFileSync(join(dir, 'dist/runtime/server/helpers.ts'), `import type { RouterMethod } from 'h3'
import { type NitroApp, type NitroRuntimeHooks } from 'nitropack'
import type { ApiClient } from '../composables/api'
export type { NitroApp, NitroRuntimeHooks, RouterMethod, ApiClient }
export const helper = () => 'ok'`)
    writeFileSync(join(dir, 'dist/runtime/composables/api.ts'), `import { useNuxtApp } from '#imports'
export type ApiClient = ReturnType<typeof useNuxtApp>`)

    const nitroConfig: NitroConfig = { handlers: [{ route: '/server', handler: join(dir, 'dist/runtime/server/handler.ts') } as any] }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [], [{ dir, name: 'type-only-module' }])

    expect(report).not.toHaveBeenCalled()
    expect(nitroConfig.plugins).toEqual([])
    vi.restoreAllMocks()
  })

  it('does not count unreferenced files in a directory a module aliased', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-alias-dir-'))
    mkdirSync(join(dir, 'dist/runtime/server/services'), { recursive: true })
    writeFileSync(join(dir, 'dist/runtime/server/services/index.ts'), `import { getCookie } from 'nuxt/server'
export const client = getCookie`)
    writeFileSync(join(dir, 'dist/runtime/server/services/unused.ts'), `import { getCookie } from 'h3'
export const legacy = getCookie`)

    const nitroConfig: NitroConfig = { handlers: [], alias: { '#module/server': join(dir, 'dist/runtime/server/services') } }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [], [{ dir, name: 'alias-module' }])

    expect(report).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it.each([false, true])('counts files in an aliased module directory that user server code imports (symlinked: %s)', async (symlinked) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = createModuleDir('nitro-compat-alias-user-', symlinked)
    const rootDir = join(dir, 'project')
    mkdirSync(join(dir, 'dist/runtime/server/services'), { recursive: true })
    mkdirSync(join(rootDir, 'server/api'), { recursive: true })
    writeFileSync(join(dir, 'dist/runtime/server/services/legacy.ts'), `import { getCookie } from 'h3'
export const legacy = getCookie`)
    writeFileSync(join(rootDir, 'server/api/test.ts'), `import { legacy } from '#module/server/legacy'
export default legacy`)

    const nitroConfig: NitroConfig = { handlers: [], alias: { '#module/server': join(dir, 'dist/runtime/server/services') } }
    const nuxt = createNuxt({ extensions: ['.js', '.mjs', '.ts'], rootDir, srcDir: rootDir, serverDir: join(rootDir, 'server'), buildDir: join(rootDir, '.nuxt'), _layers: [{ config: { rootDir, srcDir: rootDir }, cwd: rootDir }] })
    await setupNitroCompat(nuxt, nitroConfig, legacyOff, [], [{ dir, name: 'alias-module' }])

    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`alias-module` (imports `h3`)') })
    vi.restoreAllMocks()
  })

  it.each([['nitro3', false], [undefined, true]] as const)('scopes an alias of a module nested in a v2 module directory by the nested module (server: %s)', async (server, scoped) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9005').mockImplementation(() => ({}) as any)
    const rootDir = realpathSync(mkdtempSync(join(tmpdir(), 'nitro-compat-nested-alias-')))
    onTestFinished(() => rmSync(rootDir, { recursive: true, force: true }))
    const modules = join(rootDir, 'modules')
    mkdirSync(join(modules, 'nested/runtime/server'), { recursive: true })
    mkdirSync(join(rootDir, 'server/api'), { recursive: true })
    writeFileSync(join(modules, 'nested/runtime/server/query.ts'), `import { getQuery } from 'h3'
export const query = getQuery`)
    writeFileSync(join(rootDir, 'server/api/test.ts'), `import { query } from '#nested/server/query'
export default query`)

    const nitroConfig: NitroConfig = { handlers: [], alias: { '#nested/server': join(modules, 'nested/runtime/server') } }
    const nuxt = createNuxt({ extensions: ['.js', '.mjs', '.ts'], rootDir, srcDir: rootDir, serverDir: join(rootDir, 'server'), buildDir: join(rootDir, '.nuxt'), _layers: [{ config: { rootDir, srcDir: rootDir }, cwd: rootDir }] })
    await setupNitroCompat(nuxt, nitroConfig, legacyOff, [], [{ dir: modules, name: 'parent-module' }, { dir: join(modules, 'nested'), name: 'nested-module', server }])

    if (scoped) {
      expect(report.mock.calls[0]![0]).toEqual({ count: 1, modules: '`nested-module` (imports `h3`)' })
    } else {
      expect(report).not.toHaveBeenCalled()
      expect(nitroConfig.plugins).toEqual([])
    }
    vi.restoreAllMocks()
  })

  it('reports user server code that relies on Nitro v2 when `nitroLegacy` is off', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9005').mockImplementation(() => ({}) as any)
    const rootDir = mkdtempSync(join(tmpdir(), 'nitro-compat-user-'))
    mkdirSync(join(rootDir, 'server/middleware'), { recursive: true })
    writeFileSync(join(rootDir, 'server/middleware/auth.ts'), `import { eventHandler } from 'h3'
export default eventHandler(event => event.node.req.headers)`)
    writeFileSync(join(rootDir, 'server/middleware/ok.ts'), `import { defineEventHandler } from 'nuxt/server'
import type { H3Event } from 'h3'
export default defineEventHandler((event: H3Event) => event.req.headers)`)

    const nuxt = createNuxt({ rootDir, srcDir: rootDir, serverDir: join(rootDir, 'server'), buildDir: join(rootDir, '.nuxt'), _layers: [{ config: { rootDir, srcDir: rootDir }, cwd: rootDir }] })
    const nitroConfig: NitroConfig = { handlers: [] }
    const registerLate = await setupNitroCompat(nuxt, nitroConfig, legacyOff, [])
    const nitro = { options: { handlers: [], plugins: [] }, hooks: createHooks() } as any
    registerLate(nitro)
    await nitro.hooks.callHook('build:before', nitro)

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, files: expect.stringContaining('auth.ts` (uses `event.node`)') })

    report.mockClear()
    const registerLateLegacy = await setupNitroCompat(nuxt, { handlers: [] }, resolveNitroLegacyOptions(true), [])
    const legacyNitro = { options: { handlers: [], plugins: [] }, hooks: createHooks() } as any
    registerLateLegacy(legacyNitro)
    await legacyNitro.hooks.callHook('build:before', legacyNitro)
    expect(report).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('treats a file importing a module virtual of nitro v3 code as migrated', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-virtual-gate-'))
    writeFileSync(join(dir, 'handler.ts'), `import { defineCachedHandler } from '#module-virtual/server-runtime'
import { createError } from 'h3'
export default defineCachedHandler(() => createError({ statusCode: 404 }))`)

    const nitroConfig: NitroConfig = {
      virtual: { '#module-virtual/server-runtime': `export { defineCachedHandler } from 'nitro/cache'` },
      handlers: [{ route: '/icon', handler: join(dir, 'handler.ts') } as any],
    }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(report).not.toHaveBeenCalled()
    expect(nitroConfig.plugins).toEqual([])
    vi.restoreAllMocks()
  })

  it('gives an undeclared v2 handler without a route the v2 middleware semantics', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-unrouted-'))
    writeFileSync(join(dir, 'guard.ts'), `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => {})`)
    writeFileSync(join(dir, 'portable.ts'), `import { defineEventHandler } from 'nuxt/server'\nexport default defineEventHandler(() => {})`)

    const nitroConfig: NitroConfig = { handlers: [{ handler: join(dir, 'guard.ts') } as any, { handler: join(dir, 'portable.ts') } as any] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    expect(nitroConfig.handlers![0]).toMatchObject({ route: '/**', middleware: true })
    expect(nitroConfig.handlers![1]).not.toHaveProperty('route')
    expect(report).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it.each([false, true])('gives an undeclared v2 handler registered without an extension the v2 middleware semantics (symlinked: %s)', async (symlinked) => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = createModuleDir('nitro-compat-extensionless-', symlinked)
    writeFileSync(join(dir, 'guard.js'), `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => {})`)

    const nitroConfig: NitroConfig = { handlers: [{ handler: join(dir, 'guard') } as any] }
    await setupNitroCompat(createNuxt({ extensions: ['.js', '.mjs', '.ts'] }), nitroConfig, legacyOff, [])

    expect(nitroConfig.handlers![0]).toMatchObject({ route: '/**', middleware: true })
    expect(report).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('reports removed nitro v2 options without `nitroLegacy`', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9001').mockImplementation(() => ({}) as any)

    await setupNitroCompat(createNuxt({ nitro: { esbuild: { options: {} } } as any }), { handlers: [] }, legacyOff, [])

    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ keys: '`esbuild`' })

    report.mockClear()
    // still read: by nitro v3 (`ignore`) or by Nuxt itself (`imports`)
    await setupNitroCompat(createNuxt({ nitro: { ignore: ['**/*.md'], imports: { autoImport: false } } }), { handlers: [] }, legacyOff, [])
    expect(report).not.toHaveBeenCalled()

    await setupNitroCompat(createNuxt(), { handlers: [] }, legacyOff, [])
    expect(report).not.toHaveBeenCalled()
    report.mockRestore()
  })

  it('widens routed v2 middleware to a wildcard, and leaves a routed handler exact', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9004').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-prefix-'))
    writeFileSync(join(dir, 'fonts.ts'), `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => 'fonts')`)
    writeFileSync(join(dir, 'portable.ts'), `import { defineHandler } from 'nitro/h3'\nexport default defineHandler(() => 'portable')`)

    const nitroConfig: NitroConfig = {
      handlers: [
        declared({ route: '/_tagged', middleware: true, handler: join(dir, 'fonts.ts') }, 'nitro2'),
        { route: '/_untagged', middleware: true, handler: join(dir, 'fonts.ts') } as any,
        { route: '/_wildcard/**', middleware: true, handler: join(dir, 'fonts.ts') } as any,
        declared({ route: '/_routed', handler: join(dir, 'fonts.ts') }, 'nitro2'),
        declared({ route: '/_migrated', middleware: true, handler: join(dir, 'portable.ts') }, 'nitro3'),
        { route: '/api/user', middleware: true, handler: '/project/server/api/user.ts' } as any,
      ],
    }
    await setupNitroCompat(createNuxt(), nitroConfig, resolveNitroLegacyOptions(true), [])

    expect(nitroConfig.handlers![0]).toMatchObject({ route: '/_tagged/**' })
    expect(nitroConfig.handlers![1]).toMatchObject({ route: '/_untagged/**' })
    expect(nitroConfig.handlers![2]).toMatchObject({ route: '/_wildcard/**' })
    expect(nitroConfig.handlers![3]).toMatchObject({ route: '/_routed' })
    expect(nitroConfig.handlers![4]).toMatchObject({ route: '/_migrated' })
    expect(nitroConfig.handlers![5]).toMatchObject({ route: '/api/user' })
    expect(report.mock.calls.flat()).toEqual([
      expect.objectContaining({ handlers: expect.stringContaining('`/_tagged` as `/_tagged/**`') }),
      expect.objectContaining({ handlers: expect.stringContaining('`/_untagged` as `/_untagged/**`') }),
    ])

    // the wrapper strips the base the middleware was mounted at, as h3 v1 did
    expect(nitroConfig.handlers![0]).toMatchObject({ handler: '#nuxt-compat/handler-0' })
    expect((nitroConfig.virtual!['#nuxt-compat/handler-0'] as () => string)()).toContain('wrapLegacyHandler(_handler, "/_tagged")')

    // an undeclared handler the scan finds is wrapped for its base too
    const lateVirtual = nitroConfig.handlers![1]!.handler as string
    expect(lateVirtual.startsWith('#nuxt-compat/handler-')).toBe(true)
    expect((nitroConfig.virtual![lateVirtual] as () => string)()).toContain('wrapLegacyHandler(_handler, "/_untagged")')
    vi.restoreAllMocks()
  })

  it('mounts an untagged dev handler with v2 route semantics and wraps it', async () => {
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9004').mockImplementation(() => ({}) as any)
    const devServerHandlers = [
      { route: '/_module', middleware: true, handler: () => 'dev' },
      { route: '/_module-wildcard/**', middleware: true, handler: () => 'dev' },
      declared({ route: '/_module-migrated', middleware: true, handler: () => 'dev' }, 'nitro3'),
      { handler: () => 'dev' },
    ]
    const untouched = devServerHandlers.map(entry => entry.handler)
    const nitroConfig: NitroConfig = { handlers: [] }
    await setupNitroCompat(createNuxt({ devServerHandlers }), nitroConfig, legacyOff, [])

    expect(devServerHandlers[0]).toMatchObject({ route: '/_module/**' })
    expect(devServerHandlers[1]).toMatchObject({ route: '/_module-wildcard/**' })
    expect(devServerHandlers[2]).toMatchObject({ route: '/_module-migrated' })
    expect(devServerHandlers[3]).toMatchObject({ route: '/**', middleware: true })
    expect(report.mock.calls.flat()).toEqual([
      expect.objectContaining({ count: 1, handlers: '`/_module` as `/_module/**`' }),
    ])
    // wrapped in place, so the registered handler is no longer the function the module passed
    expect(devServerHandlers[0]!.handler).not.toBe(untouched[0])
    expect(devServerHandlers[3]!.handler).not.toBe(untouched[3])
    expect(devServerHandlers[2]!.handler).toBe(untouched[2])
    vi.restoreAllMocks()
  })

  it('mounts a routed v2 dev handler on its route and every path below it', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9004').mockImplementation(() => ({}) as any)
    const respond = (name: string) => (event: any) => `${name} ${event.path}`
    const devServerHandlers: any[] = [
      declared({ route: '/_tagged', handler: respond('tagged') }, 'nitro2'),
      { route: '/_untagged', handler: respond('untagged') },
      { route: '/_wildcard/**', handler: respond('wildcard') },
      { route: '/_skipped', handler: () => undefined },
      declared({ route: '/_migrated', handler: respond('migrated') }, 'nuxt'),
    ]
    await setupNitroCompat(createNuxt({ devServerHandlers }), { handlers: [] }, legacyOff, [])
    expect(report).not.toHaveBeenCalled()

    const app = new H3()
    for (const entry of devServerHandlers) {
      if (entry.middleware) {
        app.use(entry.route, entry.handler)
      } else {
        app.on('', entry.route, entry.handler)
      }
    }
    app.all('/**', () => 'fallback')
    const fetchText = async (path: string) => (await app.fetch(new Request(`http://nuxt${path}`))).text()

    expect(await fetchText('/_tagged')).toBe('tagged /')
    expect(await fetchText('/_tagged/deep')).toBe('tagged /deep')
    expect(await fetchText('/_untagged/deep')).toBe('untagged /deep')
    expect(await fetchText('/_wildcard')).toBe('wildcard /')
    expect(await fetchText('/_wildcard/deep')).toBe('wildcard /deep')
    expect(await fetchText('/_skipped/deep')).toBe('fallback')
    expect(await fetchText('/_migrated')).toBe('migrated /_migrated')
    expect(await fetchText('/_migrated/deep')).toBe('fallback')
    vi.restoreAllMocks()
  })

  it('absorbs handlers pushed straight into `nitro.options` after `nitro:config`', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-late-'))
    const late = join(dir, 'handler.ts')
    writeFileSync(late, `import { getQuery } from 'h3'\nexport default (event: any) => getQuery(event)`)

    const nitroConfig: NitroConfig = { handlers: [] }
    const registerLateScope = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }
    await expect(plugin.resolveId.handler.call(context, 'h3', late)).resolves.toBeUndefined()
    expect(nitroConfig.plugins).toEqual([])

    const options = {
      handlers: [
        { route: '/late', handler: late },
        declared({ route: '/v3', handler: '/modules/v3/handler.ts' }, 'nitro3'),
        { route: '/user', handler: '/project/server/api/test.ts' },
      ],
      plugins: [],
    }
    registerLateScope({ options, hooks: createHooks() } as any)

    await expect(plugin.resolveId.handler.call(context, 'h3', late)).resolves.toMatch(/compat[\\/]h3-v1/)
    await expect(plugin.resolveId.handler.call(context, 'h3', join(dir, 'utils.ts'))).resolves.toMatch(/compat[\\/]h3-v1/)
    await expect(plugin.resolveId.handler.call(context, 'h3', '/modules/v3/handler.ts')).resolves.toBeUndefined()
    await expect(plugin.resolveId.handler.call(context, 'h3', '/project/server/api/test.ts')).resolves.toBeUndefined()
    expect(options.plugins.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
    expect(report).toHaveBeenCalledTimes(1)
    report.mockRestore()
  })

  it('gives a routeless v2 middleware handler pushed in late a v3 route', async () => {
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-late-middleware-'))
    const late = join(dir, 'guard.ts')
    writeFileSync(late, `import { defineEventHandler } from 'h3'\nexport default defineEventHandler(() => {})`)

    const nitroConfig: NitroConfig = { handlers: [] }
    const registerLateScope = await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const options = { handlers: [{ middleware: true, handler: late }], plugins: [] }
    registerLateScope({ options, hooks: createHooks() } as any)

    expect(options.handlers[0]).toMatchObject({ route: '/**', middleware: true })
    expect(report).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('scopes userland server directories when `nitroLegacy` is enabled', async () => {
    const nitroConfig: NitroConfig = { handlers: [] }
    await setupNitroCompat(createNuxt(), nitroConfig, resolveNitroLegacyOptions(true), [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const context = { resolve: () => Promise.resolve(null) }

    await expect(plugin.resolveId.handler.call(context, 'h3', '/project/server/api/test.ts')).resolves.toMatch(/compat[\\/]h3-v1/)
    await expect(plugin.resolveId.handler.call(context, 'h3', '/project/app/app.vue')).resolves.toBeUndefined()
    expect(nitroConfig.plugins!.map(String)).toEqual([
      expect.stringMatching(/compat[\\/]event-plugin/),
      expect.stringMatching(/compat[\\/]hooks-plugin/),
    ])
  })
})

describe('scanLegacyScope', () => {
  function scoped (files: Record<string, string>) {
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-scan-'))
    for (const name in files) {
      mkdirSync(dirname(join(dir, name)), { recursive: true })
      writeFileSync(join(dir, name), files[name]!)
    }
    return dir + '/'
  }

  it('is false for a module written against `nuxt/server`', () => {
    const dir = scoped({
      'handler.ts': `import { defineEventHandler } from 'nuxt/server'\nexport default defineEventHandler(() => 'ok')`,
      'util.ts': `export const helper = () => 1`,
    })
    expect(scanLegacyScope([], [dir]).size).toBe(0)
  })

  it('is true once any scoped file imports an h3 v1 or nitropack specifier', () => {
    const dir = scoped({
      'handler.ts': `import { defineEventHandler } from 'nuxt/server'\nexport default defineEventHandler(() => 'ok')`,
      'nested/legacy.ts': `import { createError } from 'h3'\nexport const fail = () => createError({ statusCode: 418 })`,
    })
    expect([...scanLegacyScope([], [dir])]).toEqual([[join(dir, 'nested/legacy.ts'), ['h3']]])
  })

  it('ignores type-only imports', () => {
    const dir = scoped({
      'types.ts': `import type { H3Event } from 'h3'\nimport { type RouterMethod } from 'h3'\nexport type { NitroApp } from 'nitropack'\nimport type * as Imports from '#imports'\nexport type Event = H3Event | RouterMethod | typeof Imports`,
      'value.ts': `import { type H3Event, getCookie } from 'h3'\nexport const read = (event: H3Event) => getCookie(event, 'a')`,
    })
    expect([...scanLegacyScope([], [dir])]).toEqual([[join(dir, 'value.ts'), ['h3']]])
  })

  it('treats a file importing both as migrated', () => {
    const dir = scoped({
      'mixed.ts': `import { readValidatedBody } from 'nitro/h3'\nimport { useStorage } from 'nitropack/runtime'\nexport { readValidatedBody, useStorage }`,
    })
    expect(scanLegacyScope([], [dir]).size).toBe(0)
  })

  it('ignores a nested `node_modules` and unreadable entries', () => {
    const dir = scoped({
      'node_modules/dep/index.js': `import { defineEventHandler } from 'h3'`,
      'clean.ts': `export default 1`,
    })
    expect(scanLegacyScope(['#virtual-template'], [dir]).size).toBe(0)
  })
})

describe('getServerImportsPresets', () => {
  const flatten = (presets: Array<{ from: string, imports: Array<string | { name: string, as?: string }> }>) =>
    presets.flatMap(preset => preset.imports.map(entry => [typeof entry === 'string' ? entry : entry.as ?? entry.name, preset.from] as const))

  it('is the default preset list with every toggle off', async () => {
    const presets = flatten(await getServerImportsPresets(resolveNitroLegacyOptions(false)))
    const expected = flatten([nuxtServerImportsPreset, ...v2ImportsPreset, await getH3ImportsPreset()])

    expect(presets.sort()).toEqual(expected.sort())
  })

  it('redirects only the portable names the h3 shim provides', async () => {
    const presets = flatten(await getServerImportsPresets(resolveNitroLegacyOptions(true)))
    const source = new Map(presets)

    expect(presets).toHaveLength(source.size)
    // covered by `nuxt/server` alone, so unaffected by the toggles
    expect(source.get('deriveSecret')).toBe('nuxt/server')
    expect(source.get('getRouteRules')).toBe('nuxt/server')
    expect(source.get('getQuery')).toMatch(/compat[\\/]h3-v1/)
    expect(source.get('useRuntimeConfig')).toMatch(/compat[\\/]runtime-config/)
  })
})
