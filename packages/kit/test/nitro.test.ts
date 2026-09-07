import { fileURLToPath } from 'node:url'
import { createHooks } from 'hookable'
import type { Nuxt } from 'nuxt/schema'
import { describe, expect, it } from 'vitest'
import { findWorkspaceDir } from 'pkg-types'

import { checkNuxtCompatibility, getNitroVersion, hasNitroVersion } from '../src/compatibility.ts'
import { runWithNuxtContext } from '../src/context.ts'
import { defineNuxtModule } from '../src/module/define.ts'
import { addDevServerHandler, addServerHandler, addServerImports, addServerImportsDir, addServerPlugin } from '../src/nitro.ts'
import { createNitroHelpers } from '../src/nitro-helpers.ts'
import { addServerTemplate } from '../src/template.ts'

const repoRoot = await findWorkspaceDir()

function createMockNuxt (nitroVersion?: string) {
  const hooks = createHooks()
  return {
    hooks,
    hook: hooks.hook,
    callHook: hooks.callHook,
    _version: '4.0.0',
    _nitro: nitroVersion
      ? { meta: { version: nitroVersion, majorVersion: Number.parseInt(nitroVersion, 10) } }
      : undefined,
    options: {
      debug: false,
      experimental: {},
      modulesDir: [],
      serverHandlers: [],
      devServerHandlers: [],
      extensions: ['.js', '.ts', '.mjs'],
      alias: {},
      build: { transpile: [] },
      _installedModules: [],
      _layers: [{ config: { rootDir: '/project', srcDir: '/project' }, cwd: '/project' }],
      rootDir: '/project',
      srcDir: '/project',
      dir: {},
      nitro: {},
    },
  } as unknown as Nuxt
}

describe('getNitroVersion', () => {
  it('uses the initialized nitro instance metadata', () => {
    expect(getNitroVersion(createMockNuxt('2.11.0'))).toBe(2)
    expect(getNitroVersion(createMockNuxt('3.0.1'))).toBe(3)
  })

  it('falls back to package resolution, preferring the package matching the host nuxt major', () => {
    // this workspace has both nitro v3 and nitropack v2 installed
    const nuxt = createMockNuxt()
    nuxt.options.rootDir = repoRoot
    expect(getNitroVersion(nuxt)).toBe(2)

    const nuxt5 = createMockNuxt()
    nuxt5.options.rootDir = repoRoot
    ;(nuxt5 as any)._version = '5.0.0'
    expect(getNitroVersion(nuxt5)).toBe(3)
  })

  it('prefers the host-stamped `_nitroMajor` marker over anything else', () => {
    const nuxt = createMockNuxt('3.0.1')
    nuxt.options._nitroMajor = 2
    expect(getNitroVersion(nuxt)).toBe(2)
    expect(hasNitroVersion(2, nuxt)).toBe(true)
  })

  it('is reliable during setup via the marker when package resolution fails', () => {
    // simulates a non-hoisted layout: nothing resolvable from the project, no
    // initialized nitro instance, only the marker the host stamped before modules ran
    const nuxt = createMockNuxt()
    nuxt.options.rootDir = '/nonexistent-root'
    nuxt.options.modulesDir = ['/nonexistent-root/node_modules']
    nuxt.options._nitroMajor = 3
    expect(getNitroVersion(nuxt)).toBe(3)
    expect(hasNitroVersion(3, nuxt)).toBe(true)
  })
})

describe('nitro detection on an older Nuxt host', () => {
  /**
   * An older host has no `_nitro`, so detection falls back to package
   * resolution. Nothing about that path may throw, whatever the host's option
   * shape looks like.
   */
  function createHostileHost () {
    const nuxt = createMockNuxt()
    Object.defineProperty(nuxt.options, 'modulesDir', {
      get () {
        throw new Error('modulesDir is unavailable on this host')
      },
    })
    return nuxt
  }

  it('degrades to `undefined` instead of throwing when resolution misbehaves', () => {
    expect(getNitroVersion(createHostileHost())).toBeUndefined()
    expect(hasNitroVersion(2, createHostileHost())).toBe(false)
  })

  it('does not throw when the Nuxt instance has no options', () => {
    // resolution still falls back to kit's own vicinity, which is nitro v3 here
    expect(() => getNitroVersion({} as Nuxt)).not.toThrow()
    expect(hasNitroVersion(2, {} as Nuxt)).toBe(false)
  })

  it('resolves the nitro version from an unresolvable project without throwing', () => {
    const nuxt = createMockNuxt()
    nuxt.options.rootDir = '/nonexistent-root'
    nuxt.options.modulesDir = ['/nonexistent-root/node_modules']
    expect(() => getNitroVersion(nuxt)).not.toThrow()
  })

  it('registers untagged and v2 registrations even when detection fails', () => {
    const nuxt = createHostileHost()
    runWithNuxtContext(nuxt, () => {
      addServerHandler({ route: '/untagged', handler: '/handler.ts' })
      addServerHandler({ route: '/v2', handler: '/handler.ts' }, { version: 2 })
      addServerPlugin('/plugins/legacy.ts')
    })
    expect(nuxt.options.serverHandlers.map(h => h.route)).toEqual(['/untagged', '/v2'])
    expect(nuxt.options.nitro.plugins).toEqual(['/plugins/legacy.ts'])
  })

  it('does not throw from `checkNuxtCompatibility` when the nitro version is unknown', async () => {
    await expect(checkNuxtCompatibility({ nitro: '^3.0.0' }, createHostileHost())).resolves.toHaveLength(0)
  })
})

describe('nitro major marker', () => {
  it('trusts a stamped major over package resolution', () => {
    const nuxt = createMockNuxt()
    nuxt.options._nitroMajor = 2
    expect(getNitroVersion(nuxt)).toBe(2)
  })

  it('ignores a nonsense marker rather than propagating it', () => {
    for (const value of [0, 1, 4, -3, 2.5, Number.NaN, 'three', null]) {
      const nuxt = createMockNuxt('3.0.1')
      nuxt.options._nitroMajor = value as number
      // falls through to the initialized instance rather than answering `1`
      expect(getNitroVersion(nuxt)).toBe(3)
    }
  })
})

describe('hasNitroVersion', () => {
  it('checks the exact nitro major', () => {
    expect(hasNitroVersion(3, createMockNuxt('3.0.1'))).toBe(true)
    expect(hasNitroVersion(2, createMockNuxt('2.11.0'))).toBe(true)
    expect(hasNitroVersion(2, createMockNuxt('3.0.1'))).toBe(false)
    expect(hasNitroVersion(3, createMockNuxt('2.11.0'))).toBe(false)
  })
})

describe('checkNuxtCompatibility', () => {
  it('reports an issue when the nitro constraint is not satisfied', async () => {
    const issues = await checkNuxtCompatibility({ nitro: '^3.0.0' }, createMockNuxt('2.11.0'))
    expect(issues).toHaveLength(1)
    expect(issues[0]!.name).toBe('nitro')
  })

  it('passes when the nitro constraint is satisfied', async () => {
    expect(await checkNuxtCompatibility({ nitro: '^3.0.0' }, createMockNuxt('3.0.1'))).toHaveLength(0)
    expect(await checkNuxtCompatibility({ nitro: '>=2.0.0' }, createMockNuxt('2.11.0'))).toHaveLength(0)
  })
})

describe('addServerHandler', () => {
  it('registers untagged handlers unchanged', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: '/handlers/test.get.ts' }))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: 'GET', route: '/test', handler: '/handlers/test.get.ts' },
    ])
  })

  it('tags handlers with an explicit version', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: '/handlers/test.ts' }, { version: 3 }))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/test', handler: '/handlers/test.ts', version: 3 },
    ])
  })

  it('skips v3 handlers on a nitro v2 host and records the skip', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: '/handlers/test.ts' }, { version: 3 }))
    expect(nuxt.options.serverHandlers).toEqual([])
    expect(nuxt._skippedNitroRegistrations).toEqual([{ api: 'addServerHandler', version: 3, host: 2 }])
  })

  it('rejects a version map passed as the `handler` field', () => {
    const nuxt = createMockNuxt('3.0.1')
    // the whole registration is versioned, not the handler
    const invalid = { route: '/test', handler: { 2: '/handler.v2.ts', 3: '/handler.v3.ts' } } as unknown as Parameters<typeof addServerHandler>[0]
    const error = (() => {
      try {
        runWithNuxtContext(nuxt, () => addServerHandler(invalid))
      } catch (error) {
        return error as Error & { code?: string }
      }
    })()

    expect(error?.code).toBe('NUXT_B8025')
    expect(error?.message).toContain('per-nitro-version map')
    expect(nuxt.options.serverHandlers).toEqual([])
  })

  it('picks the variant matching the host nitro version', () => {
    for (const [nitroVersion, expected] of [['2.11.0', 2], ['3.0.1', 3]] as const) {
      const nuxt = createMockNuxt(nitroVersion)
      runWithNuxtContext(nuxt, () => addServerHandler({
        2: { route: '/test', handler: '/handlers/test.v2.ts' },
        3: { route: '/test', handler: '/handlers/test.v3.ts' },
      }))
      expect(nuxt.options.serverHandlers).toEqual([
        { method: undefined, route: '/test', handler: `/handlers/test.v${expected}.ts`, version: expected },
      ])
    }
  })

  it('falls back to a v2 variant on a nitro v3 host', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerHandler({
      2: { route: '/test', handler: '/handlers/test.v2.ts' },
    }))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/test', handler: '/handlers/test.v2.ts', version: 2 },
    ])
  })

  it('skips a v3-only variant on a nitro v2 host', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerHandler({
      3: { route: '/test', handler: '/handlers/test.v3.ts' },
    }))
    expect(nuxt.options.serverHandlers).toEqual([])
  })
})

describe('addDevServerHandler', () => {
  it('tags dev handlers with an explicit version', () => {
    const nuxt = createMockNuxt('3.0.1')
    const handler = () => {}
    runWithNuxtContext(nuxt, () => addDevServerHandler({ route: '/test', handler }, { version: 3 }))
    expect(nuxt.options.devServerHandlers).toEqual([{ route: '/test', handler, version: 3 }])
  })

  it('rejects a version map passed as the `handler` field', () => {
    const nuxt = createMockNuxt('3.0.1')
    // the whole registration is versioned, not the handler
    const invalid = { route: '/test', handler: { 2: '/handler.v2.ts', 3: '/handler.v3.ts' } } as unknown as Parameters<typeof addServerHandler>[0]
    const error = (() => {
      try {
        runWithNuxtContext(nuxt, () => addServerHandler(invalid))
      } catch (error) {
        return error as Error & { code?: string }
      }
    })()

    expect(error?.code).toBe('NUXT_B8025')
    expect(error?.message).toContain('per-nitro-version map')
    expect(nuxt.options.serverHandlers).toEqual([])
  })

  it('picks the variant matching the host nitro version', () => {
    const nuxt = createMockNuxt('2.11.0')
    const v2 = () => {}
    const v3 = () => {}
    runWithNuxtContext(nuxt, () => addDevServerHandler({
      2: { route: '/test', handler: v2 },
      3: { route: '/test', handler: v3 },
    }))
    expect(nuxt.options.devServerHandlers).toEqual([{ route: '/test', handler: v2, version: 2 }])
  })
})

describe('addServerPlugin', () => {
  it('registers untagged plugins unchanged', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerPlugin('/plugins/test.ts'))
    expect(nuxt.options.nitro.plugins).toEqual(['/plugins/test.ts'])
    expect((nuxt as any)._serverPluginVersions).toBeUndefined()
  })

  it('records plugin versions by normalized path', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerPlugin('\\plugins\\test.ts', { version: 3 }))
    expect(nuxt.options.nitro.plugins).toEqual(['/plugins/test.ts'])
    expect((nuxt as any)._serverPluginVersions.get('/plugins/test.ts')).toBe(3)
  })

  it('also records the alias-resolved plugin path', () => {
    const nuxt = createMockNuxt('3.0.1')
    nuxt.options.alias = { '#test-mod': '/mods/test-module' }
    runWithNuxtContext(nuxt, () => addServerPlugin('#test-mod/plugin.mjs', { version: 3 }))
    const versions = nuxt._serverPluginVersions!
    expect(versions.get('#test-mod/plugin.mjs')).toBe(3)
    expect(versions.get('/mods/test-module/plugin.mjs')).toBe(3)
  })

  it('also records the plugin path resolved to a file', () => {
    const nuxt = createMockNuxt('3.0.1')
    const extensionless = fileURLToPath(new URL('./nitro.test', import.meta.url))
    runWithNuxtContext(nuxt, () => addServerPlugin(extensionless, { version: 2 }))
    const versions = (nuxt as any)._serverPluginVersions
    expect(versions.get(extensionless.replace(/\\/g, '/'))).toBe(2)
    expect(versions.get(`${extensionless.replace(/\\/g, '/')}.ts`)).toBe(2)
  })

  it('rejects a version map passed as the `handler` field', () => {
    const nuxt = createMockNuxt('3.0.1')
    // the whole registration is versioned, not the handler
    const invalid = { route: '/test', handler: { 2: '/handler.v2.ts', 3: '/handler.v3.ts' } } as unknown as Parameters<typeof addServerHandler>[0]
    const error = (() => {
      try {
        runWithNuxtContext(nuxt, () => addServerHandler(invalid))
      } catch (error) {
        return error as Error & { code?: string }
      }
    })()

    expect(error?.code).toBe('NUXT_B8025')
    expect(error?.message).toContain('per-nitro-version map')
    expect(nuxt.options.serverHandlers).toEqual([])
  })

  it('picks the variant matching the host nitro version', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerPlugin({ 2: '/plugins/test.v2.ts', 3: '/plugins/test.v3.ts' }))
    expect(nuxt.options.nitro.plugins).toEqual(['/plugins/test.v3.ts'])
    expect((nuxt as any)._serverPluginVersions.get('/plugins/test.v3.ts')).toBe(3)
  })

  it('skips a v3-only plugin on a nitro v2 host', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerPlugin({ 3: '/plugins/test.v3.ts' }))
    expect(nuxt.options.nitro.plugins).toBeUndefined()
  })
})

describe('server source versions', () => {
  it('records auto-import sources, directories and template ids', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => {
      addServerImports([{ name: 'useThing', from: '/modules/runtime/utils' }])
      addServerImports([{ name: 'useOther', from: '/modules/v3/utils' }], { version: 3 })
      addServerImportsDir('/modules/runtime/server/utils')
      addServerImportsDir('/modules/v3/server/utils', { version: 3 })
      addServerTemplate({ filename: '#module-template', getContents: () => '' })
      addServerTemplate({ filename: '#module-template-v3', getContents: () => '' }, { version: 3 })
    })

    const versions = (nuxt as any)._serverImportVersions as Map<string, number>
    // untagged sources are not recorded: absent means nitro v2
    expect(versions.get('/modules/runtime/utils')).toBeUndefined()
    expect(versions.get('/modules/v3/utils')).toBe(3)
    expect(versions.get('/modules/v3/server/utils')).toBe(3)
    expect(versions.get('#module-template-v3')).toBe(3)
    expect(versions.get('#module-template')).toBeUndefined()
  })
})

describe('module-level nitro compatibility', () => {
  async function installTestModule (nuxt: Nuxt, nitro?: string) {
    const testModule = defineNuxtModule({
      meta: { name: `test-nitro-compat-${nitro ?? 'default'}-${(nuxt as any)._nitro?.meta.version}`, compatibility: nitro ? { nitro } : undefined },
      setup () {
        addServerHandler({ route: '/default', handler: '/handlers/default.ts' })
        addServerHandler({ route: '/explicit', handler: '/handlers/explicit.ts' }, { version: 2 })
      },
    })
    await runWithNuxtContext(nuxt, () => testModule({}, nuxt))
  }

  it('is a requirement check only and does not version the module registrations', async () => {
    const nuxt = createMockNuxt('3.0.1')
    await installTestModule(nuxt, '^3.0.0')
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/default', handler: '/handlers/default.ts' },
      { method: undefined, route: '/explicit', handler: '/handlers/explicit.ts', version: 2 },
    ])
  })

  it('disables modules declaring an unsatisfied nitro constraint', async () => {
    const nuxt = createMockNuxt('2.11.0')
    await installTestModule(nuxt, '^3.0.0')
    expect(nuxt.options.serverHandlers).toEqual([])
  })
})

describe('createNitroHelpers', () => {
  it('binds the version, including inside hook callbacks', async () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => {
      const nitro3 = createNitroHelpers({ version: 3 })
      nitro3.addServerHandler({ route: '/bound', handler: '/handlers/bound.ts' })
      nuxt.hook('modules:done', () => {
        nitro3.addServerHandler({ route: '/hooked', handler: '/handlers/hooked.ts' })
      })
    })
    await runWithNuxtContext(nuxt, () => nuxt.callHook('modules:done'))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/bound', handler: '/handlers/bound.ts', version: 3 },
      { method: undefined, route: '/hooked', handler: '/handlers/hooked.ts', version: 3 },
    ])
  })

  it('records versions for plugins, imports and templates', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => {
      const nitro3 = createNitroHelpers({ version: 3 })
      nitro3.addServerPlugin('/plugins/bound.ts')
      nitro3.addServerImports([{ name: 'useBound', from: '/bound/utils' }])
      nitro3.addServerImportsDir('/bound/server/utils')
      nitro3.addServerTemplate({ filename: '#bound-template', getContents: () => '' })
    })
    expect(nuxt._serverPluginVersions!.get('/plugins/bound.ts')).toBe(3)
    const imports = nuxt._serverImportVersions!
    expect(imports.get('/bound/utils')).toBe(3)
    expect(imports.get('/bound/server/utils')).toBe(3)
    expect(imports.get('#bound-template')).toBe(3)
  })
})
