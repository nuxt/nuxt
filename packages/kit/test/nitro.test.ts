import { createHooks } from 'hookable'
import type { Nuxt } from 'nuxt/schema'
import { describe, expect, it, vi } from 'vitest'
import { findWorkspaceDir } from 'pkg-types'

import { checkNuxtCompatibility, getNitroVersion } from '../src/compatibility.ts'
import { runWithNuxtContext } from '../src/context.ts'
import { kitDiagnostics } from '../src/diagnostics/kit-api.ts'
import { defineNuxtModule } from '../src/module/define.ts'

import { addDevServerHandler, addNitroPlugin, addServerHandler, addServerImports, addServerImportsDir, addServerPlugin, getHostServerApis, kServerApi, kUnusedVariants } from '../src/nitro.ts'
import { addServerTemplate } from '../src/template.ts'

const serverApiOf = (entry: object) => (entry as Record<symbol, string | undefined>)[kServerApi]
const unusedVariantsOf = (entry: object) => (entry as Record<symbol, string[] | undefined>)[kUnusedVariants]

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
      _serverPlugins: [],
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
  })

  it('is reliable during setup via the marker when package resolution fails', () => {
    // simulates a non-hoisted layout: nothing resolvable from the project, no
    // initialized nitro instance, only the marker the host stamped before modules ran
    const nuxt = createMockNuxt()
    nuxt.options.rootDir = '/nonexistent-root'
    nuxt.options.modulesDir = ['/nonexistent-root/node_modules']
    nuxt.options._nitroMajor = 3
    expect(getNitroVersion(nuxt)).toBe(3)
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
  })

  it('does not throw when the Nuxt instance has no options', () => {
    // resolution still falls back to kit's own vicinity, which is nitro v3 here
    expect(() => getNitroVersion({} as Nuxt)).not.toThrow()
  })

  it('resolves the nitro version from an unresolvable project without throwing', () => {
    const nuxt = createMockNuxt()
    nuxt.options.rootDir = '/nonexistent-root'
    nuxt.options.modulesDir = ['/nonexistent-root/node_modules']
    expect(() => getNitroVersion(nuxt)).not.toThrow()
  })

  it('registers server code even when detection fails', () => {
    const nuxt = createHostileHost()
    runWithNuxtContext(nuxt, () => {
      addServerHandler({ route: '/plain', handler: '/handler.ts' })
      addServerHandler({ route: '/variants', handler: { nitro2: '/handler.v2.ts', nuxt: '/handler.ts' } })
      addNitroPlugin('/plugins/legacy.ts')
    })
    expect(nuxt.options.serverHandlers.map(h => h.route)).toEqual(['/plain', '/variants'])
    expect(nuxt.options._serverPlugins).toEqual([{ plugin: '/plugins/legacy.ts', compatibility: undefined, unused: [] }])
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

describe('getHostServerApis', () => {
  it('orders what a nitro host runs, most preferred first', () => {
    expect(getHostServerApis(createMockNuxt('3.0.1'))).toEqual(['nitro3', 'nuxt', 'nitro2'])
    expect(getHostServerApis(createMockNuxt('2.11.0'))).toEqual(['nitro2', 'nuxt'])
  })

  it('only runs portable code under a server builder that is not nitro', () => {
    for (const builder of ['@nuxt/vite-server', '/project/server-builder.ts', { bundle: () => Promise.resolve() }]) {
      const nuxt = createMockNuxt('3.0.1')
      ;(nuxt.options as any).server = { builder }
      expect(getHostServerApis(nuxt)).toEqual(['nuxt'])
    }
  })

  it('recognises the nitro builder given as a file path', () => {
    for (const builder of ['@nuxt/nitro-server', '/repo/node_modules/@nuxt/nitro-server/dist/index.mjs', '/repo/packages/nitro-server/src/index.ts']) {
      const nuxt = createMockNuxt('3.0.1')
      ;(nuxt.options as any).server = { builder }
      expect(getHostServerApis(nuxt)).toEqual(['nitro3', 'nuxt', 'nitro2'])
    }
  })

  it('is unknown when nothing identifies the host', () => {
    const nuxt = createMockNuxt()
    Object.defineProperty(nuxt.options, 'modulesDir', { get () { throw new Error('unavailable') } })
    expect(getHostServerApis(nuxt)).toBeUndefined()
  })
})

describe('addServerHandler', () => {
  it('registers a handler with the method its filename implies', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: '/handlers/test.get.ts' }))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: 'GET', route: '/test', handler: '/handlers/test.get.ts' },
    ])
  })

  it('registers the implementation this host runs, of one per server API', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerHandler({
      route: '/test',
      handler: { nuxt: '/handlers/test.ts', nitro2: '\\handlers\\test.v2.ts' },
    }))
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/test', handler: '/handlers/test.ts' },
    ])
    expect(serverApiOf(nuxt.options.serverHandlers[0]!)).toBe('nuxt')
    expect(unusedVariantsOf(nuxt.options.serverHandlers[0]!)).toEqual(['/handlers/test.v2.ts'])
  })

  it('registers the nitro v2 implementation on a nitro v2 host', () => {
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerHandler({
      route: '/test',
      handler: { nuxt: '/handlers/test.ts', nitro2: '/handlers/test.v2.ts', nitro3: '/handlers/test.v3.ts' },
    }))
    expect(nuxt.options.serverHandlers.map(h => h.handler)).toEqual(['/handlers/test.v2.ts'])
  })

  it('reports and skips a registration whose implementations the host cannot run', () => {
    const report = vi.spyOn(kitDiagnostics, 'NUXT_B8024').mockImplementation(() => ({}) as any)
    const nuxt = createMockNuxt('2.11.0')
    runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: { nitro3: '/handlers/test.v3.ts' } }))
    expect(nuxt.options.serverHandlers).toEqual([])
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0]![0]).toMatchObject({ api: 'addServerHandler', declared: 'nitro3' })
    report.mockRestore()
  })

  it('takes the filename convention from the implementation it registered', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addServerHandler({ handler: { nitro2: '/handlers/test.post.ts' } }))
    expect(nuxt.options.serverHandlers[0]!.method).toBe('POST')
  })

  it('writes an entry a host older than this kit can consume', () => {
    // an older host hands `serverHandlers` entries straight to nitro v2, so nothing beyond
    // the keys nitro knows may be enumerable on them
    const nuxt = createMockNuxt('2.11.0')
    delete (nuxt.options as { _serverPlugins?: unknown })._serverPlugins
    runWithNuxtContext(nuxt, () => {
      addServerHandler({ route: '/test', handler: { nitro2: '/handlers/test.v2.ts', nuxt: '/handlers/test.ts' } })
      addNitroPlugin({ nitro2: '/plugins/test.v2.ts', nitro3: '/plugins/test.v3.ts' })
    })
    expect(JSON.parse(JSON.stringify(nuxt.options.serverHandlers))).toEqual([
      { route: '/test', handler: '/handlers/test.v2.ts' },
    ])
    expect(Object.keys(nuxt.options.serverHandlers[0]!).sort()).toEqual(['handler', 'method', 'route'])
    expect(nuxt.options.nitro.plugins).toEqual(['/plugins/test.v2.ts'])
  })

  it('rejects a variant key that is not a server API', () => {
    const nuxt = createMockNuxt('3.0.1')
    let error: (Error & { code?: string }) | undefined
    try {
      runWithNuxtContext(nuxt, () => addServerHandler({ route: '/test', handler: { nitro4: '/handlers/test.ts' } as any }))
    } catch (e) {
      error = e as Error
    }
    expect(error?.code).toBe('NUXT_B8025')
    expect(nuxt.options.serverHandlers).toEqual([])
  })

  it('registers into the array a server builder already holds', () => {
    const nuxt = createMockNuxt('3.0.1')
    const handlers = nuxt.options.serverHandlers
    runWithNuxtContext(nuxt, () => {
      addServerHandler({ route: '/early', handler: '/handlers/early.ts' })
      addServerHandler({ route: '/late', handler: { nitro3: '/handlers/late.ts' } })
    })
    expect(handlers[1]!.handler).toBe('/handlers/late.ts')
    expect(handlers.map(h => h.route)).toEqual(['/early', '/late'])
    expect(nuxt.options.serverHandlers).toBe(handlers)
  })
})

describe('addDevServerHandler', () => {
  it('registers the implementation this host runs', () => {
    const nuxt = createMockNuxt('3.0.1')
    const v2 = () => {}
    const v3 = { fetch: () => new Response() }
    runWithNuxtContext(nuxt, () => addDevServerHandler({ route: '/test', handler: { nitro2: v2, nitro3: v3 } }))
    expect(nuxt.options.devServerHandlers).toEqual([{ route: '/test', handler: v3 }])
    expect(serverApiOf(nuxt.options.devServerHandlers[0]!)).toBe('nitro3')
  })
})

describe('addNitroPlugin', () => {
  it('registers a normalized path', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addNitroPlugin('\\plugins\\test.ts'))
    expect(nuxt.options._serverPlugins).toEqual([{ plugin: '/plugins/test.ts', compatibility: undefined, unused: [] }])
    expect(nuxt.options.nitro.plugins).toBeUndefined()
  })

  it('registers the implementation this host runs, of one per nitro major', () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => addNitroPlugin({ nitro3: '/plugins/test.ts', nitro2: '/plugins/test.v2.ts' }))
    expect(nuxt.options._serverPlugins).toEqual([
      { plugin: '/plugins/test.ts', compatibility: 'nitro3', unused: ['/plugins/test.v2.ts'] },
    ])
  })

  it('is skipped when it names a nitro major the host does not run', () => {
    const report = vi.spyOn(kitDiagnostics, 'NUXT_B8024').mockImplementation(() => ({}) as any)
    const nuxt = createMockNuxt('3.0.1')
    ;(nuxt.options as any).server = { builder: '@nuxt/vite-server' }
    runWithNuxtContext(nuxt, () => addNitroPlugin({ nitro3: '/plugins/test.v3.ts' }))
    expect(nuxt.options._serverPlugins).toEqual([])
    expect(report).toHaveBeenCalledTimes(1)
    report.mockRestore()
  })

  it('has no portable variant, since there is no portable plugin surface', () => {
    const nuxt = createMockNuxt('3.0.1')
    let error: (Error & { code?: string }) | undefined
    try {
      runWithNuxtContext(nuxt, () => addNitroPlugin({ nuxt: '/plugins/test.ts' } as any))
    } catch (e) {
      error = e as Error
    }
    expect(error?.code).toBe('NUXT_B8025')
    expect(nuxt.options._serverPlugins).toEqual([])
  })

  it('is still reachable under its former name', () => {
    const nuxt = createMockNuxt('3.0.1')
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the alias is what is under test
    runWithNuxtContext(nuxt, () => addServerPlugin('/plugins/test.ts'))
    expect(nuxt.options._serverPlugins).toEqual([{ plugin: '/plugins/test.ts', compatibility: undefined, unused: [] }])
  })
})

describe('addServerImports', () => {
  it('adds imports and directories through `nitro:config`', async () => {
    const nuxt = createMockNuxt('3.0.1')
    runWithNuxtContext(nuxt, () => {
      addServerImports([{ name: 'useThing', from: '/modules/runtime/utils' }])
      addServerImportsDir('/modules/runtime/server/utils')
    })
    const config: { imports?: { imports?: Array<{ name: string }>, dirs?: string[] } } = {}
    await runWithNuxtContext(nuxt, () => nuxt.callHook('nitro:config', config as any))
    expect(config.imports!.imports).toEqual([{ name: 'useThing', from: '/modules/runtime/utils' }])
    expect(config.imports!.dirs).toEqual(['/modules/runtime/server/utils'])
  })
})

describe('addServerTemplate', () => {
  it('registers a virtual module for the server build', () => {
    const nuxt = createMockNuxt('3.0.1')
    const getContents = () => ''
    runWithNuxtContext(nuxt, () => addServerTemplate({ filename: '#module-template', getContents }))
    expect(nuxt.options.nitro.virtual).toEqual({ '#module-template': getContents })
  })
})

describe('module-level nitro compatibility', () => {
  async function installTestModule (nuxt: Nuxt, nitro?: string) {
    const testModule = defineNuxtModule({
      meta: { name: `test-nitro-compat-${nitro ?? 'default'}-${(nuxt as any)._nitro?.meta.version}`, compatibility: nitro ? { nitro } : undefined },
      setup () {
        addServerHandler({ route: '/test', handler: '/handlers/test.ts' })
      },
    })
    await runWithNuxtContext(nuxt, () => testModule({}, nuxt))
  }

  it('is a requirement check only and does not declare the module registrations', async () => {
    const nuxt = createMockNuxt('3.0.1')
    await installTestModule(nuxt, '^3.0.0')
    expect(nuxt.options.serverHandlers).toEqual([
      { method: undefined, route: '/test', handler: '/handlers/test.ts' },
    ])
  })

  it('disables modules declaring an unsatisfied nitro constraint', async () => {
    const nuxt = createMockNuxt('2.11.0')
    await installTestModule(nuxt, '^3.0.0')
    expect(nuxt.options.serverHandlers).toEqual([])
  })
})
