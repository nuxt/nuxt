import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'pathe'
import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitro/types'

import { createUnimport } from 'unimport'
import { resolveModulePath } from 'exsolve'

import { getLegacyRuntimeConfigPath, getNitroPackageResolutions, getServerImportsPresets, resolveNitroLegacyOptions, scanLegacyScope, setupNitroCompat } from '../src/compat.ts'
import { getH3ImportsPreset, nuxtServerImportsPreset, v2ImportsPreset } from '../src/imports.ts'
import { nitroBuildDiagnostics } from '../src/diagnostics.ts'
import { kServerApi } from '@nuxt/kit/internal'

/** An entry as `addServerHandler()` leaves it, having resolved the variant it registered. */
function declared<T extends object> (entry: T, api: string): any {
  return Object.defineProperty(entry, kServerApi, { value: api, configurable: true })
}

function createNuxt (options: Record<string, any> = {}) {
  const listeners: Record<string, Array<(...args: any[]) => any>> = {}
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
    hook: (name: string, listener: (...args: any[]) => any) => {
      (listeners[name] ||= []).push(listener)
    },
    hooks: {
      callHook: async (name: string, ...args: any[]) => {
        for (const listener of listeners[name] || []) {
          await listener(...args)
        }
      },
    },
  } as unknown as Nuxt
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

  it('resolves nitro for module code only where the bundler cannot', async () => {
    const nitroConfig: NitroConfig = { handlers: [] }
    await setupNitroCompat(createNuxt(), nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const unresolvable = { resolve: () => Promise.resolve(null) }
    const resolvable = { resolve: () => Promise.resolve({ id: '/project/node_modules/nitro/dist/app.mjs' }) }

    await expect(plugin.resolveId.handler.call(unresolvable, 'nitro/app', '/modules/handler.ts')).resolves.toMatch(/nitro/)
    // nitro resolving itself must win, or the dev server and the app get separate instances
    await expect(plugin.resolveId.handler.call(resolvable, 'nitro/app', '/modules/handler.ts')).resolves.toBeUndefined()
    await expect(plugin.resolveId.handler.call(unresolvable, 'nitro/builder', '/modules/handler.ts')).resolves.toBeUndefined()
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

  it('installs the runtime plugin and reports the module once a scoped file imports h3 v1', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-module-'))
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
    const nuxt = createNuxt()
    const registerLateScope = await setupNitroCompat(nuxt, nitroConfig, legacyOff, [])

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const transformed = await plugin.transform.handler.call(null, `import { useStorage } from 'nitropack/runtime'`, '#virtual-module/template')
    expect(transformed.code).toMatch(/compat[\\/]nitro-v2/)
    expect(await plugin.transform.handler.call(null, `import { createError } from 'h3'`, '#internal/nuxt/own')).toBeUndefined()

    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
    expect(report.mock.calls[0]![0]).toMatchObject({ count: 1, modules: expect.stringContaining('`#virtual-module/template` (imports `nitropack/runtime`)') })

    // a template function is rendered once the app has been generated, so its evidence arrives late
    await registerLateScope({ options: { alias: {}, plugins: nitroConfig.plugins, handlers: nitroConfig.handlers } } as any)
    await nuxt.hooks.callHook('build:done')

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

    const nuxt = createNuxt()
    const registerLateScope = await setupNitroCompat(nuxt, nitroConfig, legacyOff, [])

    nitroReady!()
    await registerLateScope({ options: { alias: {}, plugins: nitroConfig.plugins, handlers: nitroConfig.handlers } } as any)
    await nuxt.hooks.callHook('build:done')

    const plugin = (nitroConfig.rollupConfig!.plugins as any[])[0]
    const transformed = await plugin.transform.handler.call(null, `import { useStorage } from 'nitropack/runtime'`, '#virtual-module/late')
    expect(transformed.code).toMatch(/compat[\\/]nitro-v2/)
    expect(nitroConfig.plugins!.map(String)).toEqual([expect.stringMatching(/compat[\\/]event-plugin/), expect.stringMatching(/compat[\\/]hooks-plugin/)])
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

  it('attributes module files the server build reaches through an import', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-reachable-'))
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

  it('gives an undeclared v2 handler registered without an extension the v2 middleware semantics', async () => {
    const report = vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9002').mockImplementation(() => ({}) as any)
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9003').mockImplementation(() => ({}) as any)
    const dir = mkdtempSync(join(tmpdir(), 'nitro-compat-extensionless-'))
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
    vi.spyOn(nitroBuildDiagnostics, 'NUXT_B9004').mockImplementation(() => ({}) as any)
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
    // wrapped in place, so the registered handler is no longer the function the module passed
    expect(devServerHandlers[0]!.handler).not.toBe(untouched[0])
    expect(devServerHandlers[3]!.handler).not.toBe(untouched[3])
    expect(devServerHandlers[2]!.handler).toBe(untouched[2])
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
    registerLateScope({ options } as any)

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
    registerLateScope({ options } as any)

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
    expect(source.get('toNuxtRequestEvent')).toBe('nuxt/server')
    expect(source.get('getRouteRules')).toBe('nuxt/server')
    expect(source.get('getQuery')).toMatch(/compat[\\/]h3-v1/)
    expect(source.get('useRuntimeConfig')).toMatch(/compat[\\/]runtime-config/)
  })
})
