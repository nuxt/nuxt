import type { Nuxt } from '@nuxt/schema'
import type { NastiPlugin } from '@nasti-toolchain/nasti'
import { describe, expect, it } from 'vitest'
import { ReplacePlugins } from '../../src/plugins/replace.ts'

function createNuxt (overrides: Record<string, any> = {}) {
  return {
    _version: '3.99.0',
    options: {
      dev: true,
      test: false,
      experimental: { asyncContext: true },
      ...overrides,
    },
  } as unknown as Nuxt
}

type TransformFn = (code: string, id: string) => { code: string, map?: unknown } | undefined
function transformOf (plugin: NastiPlugin): TransformFn {
  const fn = plugin.transform as any
  return (code, id) => fn.call({}, code, id)
}

function plugins (nuxt: Nuxt) {
  const [client, server] = ReplacePlugins(nuxt)
  return { client: client!, server: server! }
}

describe('ReplacePlugins', () => {
  it('returns one plugin per environment, scoped by consumer', () => {
    const { client, server } = plugins(createNuxt())

    expect(client.name).toBe('nuxt:nasti:replace:client')
    expect(server.name).toBe('nuxt:nasti:replace:server')
    expect(client.enforce).toBe('post')

    expect(client.applyToEnvironment?.({ consumer: 'client' } as any)).toBe(true)
    expect(client.applyToEnvironment?.({ consumer: 'server' } as any)).toBe(false)
    expect(server.applyToEnvironment?.({ consumer: 'server' } as any)).toBe(true)
    expect(server.applyToEnvironment?.({ consumer: 'client' } as any)).toBe(false)
  })

  it('replaces import.meta.* per environment in the client build', () => {
    const { client } = plugins(createNuxt())
    const out = transformOf(client)('const s = import.meta.server; const c = import.meta.client; const b = import.meta.browser', 'app.ts')

    expect(out?.code).toContain('const s = false')
    expect(out?.code).toContain('const c = true')
    expect(out?.code).toContain('const b = true')
  })

  it('replaces import.meta.* per environment in the server build', () => {
    const { server } = plugins(createNuxt())
    const out = transformOf(server)('const s = import.meta.server; const c = import.meta.client', 'app.ts')

    expect(out?.code).toContain('const s = true')
    expect(out?.code).toContain('const c = false')
  })

  it('replaces the compile-time constants from Nuxt options', () => {
    const { client } = plugins(createNuxt({ dev: false, test: true, experimental: { asyncContext: false } }))
    const out = transformOf(client)(
      'a=import.meta.dev;b=import.meta.test;c=import.meta.nitro;v=__NUXT_VERSION__;x=__NUXT_ASYNC_CONTEXT__',
      'app.ts',
    )

    expect(out?.code).toContain('a=false')
    expect(out?.code).toContain('b=true')
    expect(out?.code).toContain('c=false')
    expect(out?.code).toContain('v="3.99.0"')
    expect(out?.code).toContain('x=false')
  })

  it('only matches whole identifiers', () => {
    const { client } = plugins(createNuxt())

    // A real match drives the transform; `import.meta.servers` (trailing word char) and a
    // `.`-prefixed member access must survive untouched.
    const out = transformOf(client)(
      'const real = import.meta.client; const a = import.meta.servers; const b = foo.import.meta.server',
      'app.ts',
    )

    expect(out?.code).toContain('const real = true')
    expect(out?.code).toContain('import.meta.servers')
    expect(out?.code).toContain('foo.import.meta.server')
  })

  it('skips non-JS modules', () => {
    const { client } = plugins(createNuxt())
    expect(transformOf(client)('.x { color: import.meta.client }', 'styles.css')).toBeUndefined()
  })

  it('returns undefined when nothing matches', () => {
    const { client } = plugins(createNuxt())
    expect(transformOf(client)('const a = 1', 'app.ts')).toBeUndefined()
  })

  it('returns code and a sourcemap when it rewrites', () => {
    const { client } = plugins(createNuxt())
    const out = transformOf(client)('const c = import.meta.client', 'app.ts') as { code: string, map?: unknown }
    expect(out.code).toContain('true')
    expect(out.map).toBeTruthy()
  })
})
