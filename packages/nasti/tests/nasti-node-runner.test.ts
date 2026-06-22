import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NastiNodeRunner } from '../src/nasti-node-runner.ts'

vi.mock('#nasti-node', () => ({
  nastiNodeFetch: {
    resolveId: vi.fn(),
    fetchModule: vi.fn(),
    getManifest: vi.fn(),
    getInvalidates: vi.fn(),
    ensureConnected: vi.fn(),
  },
  nastiNodeOptions: { baseURL: 'http://localhost:3000', entryPath: '/srv/entry.mjs' },
}))

let runner: NastiNodeRunner
let fetchModule: ReturnType<typeof vi.fn>
let resolveId: ReturnType<typeof vi.fn>

beforeEach(async () => {
  // Fresh import per test so the runner's module-level cache starts empty.
  vi.resetModules()
  const mocked = await import('#nasti-node') as any
  fetchModule = mocked.nastiNodeFetch.fetchModule
  resolveId = mocked.nastiNodeFetch.resolveId
  // The mock factory result persists across resetModules, so clear call history/impls here.
  fetchModule.mockReset()
  resolveId.mockReset()
  runner = (await import('../src/nasti-node-runner.ts')).default
})

describe('executeId', () => {
  it('natively imports an externalized module', async () => {
    fetchModule.mockResolvedValue({ externalize: 'node:path' })
    const mod = await runner.executeId('/anything')
    expect(mod.join).toBeTypeOf('function')
  })

  it('evaluates fetched code and surfaces __vite_ssr_exports__', async () => {
    fetchModule.mockResolvedValue({ code: '__vite_ssr_exports__.foo = 42', file: '/m.js' })
    const mod = await runner.executeId('/m.js')
    expect(mod.foo).toBe(42)
  })

  it('re-exports keys via __vite_ssr_exportAll__, excluding default', async () => {
    fetchModule.mockResolvedValue({ code: '__vite_ssr_exportAll__({ a: 1, b: 2, default: 9 })', file: '/e.js' })
    const mod = await runner.executeId('/e.js')
    expect(mod.a).toBe(1)
    expect(mod.b).toBe(2)
    expect(mod.default).toBeUndefined()
  })

  it('treats node: builtins and bare specifiers as native externals (no resolveId call)', async () => {
    fetchModule.mockResolvedValue({
      code: 'const os = await __vite_ssr_import__("node:os"); const p = await __vite_ssr_import__("pathe"); __vite_ssr_exports__.ok = typeof os.platform === "function" && typeof p.join === "function"',
      file: '/uses-external.js',
    })
    const mod = await runner.executeId('/uses-external.js')
    expect(mod.ok).toBe(true)
    expect(resolveId).not.toHaveBeenCalled()
  })

  it('routes Nuxt aliases, relative and absolute ids through the dev server resolver', async () => {
    resolveId.mockResolvedValue(null)
    fetchModule.mockImplementation((id: string) => {
      if (id === '/main.js') {
        return { code: 'await __vite_ssr_import__("#app"); await __vite_ssr_import__("./rel"); await __vite_ssr_import__("/abs")', file: '/main.js' }
      }
      return { code: '', file: id }
    })

    await runner.executeId('/main.js')

    expect(resolveId).toHaveBeenCalledWith('#app', '/main.js')
    expect(resolveId).toHaveBeenCalledWith('./rel', '/main.js')
    expect(resolveId).toHaveBeenCalledWith('/abs', '/main.js')
  })

  it('caches modules so a repeated id is fetched once', async () => {
    fetchModule.mockResolvedValue({ code: '__vite_ssr_exports__.n = 1', file: '/c.js' })
    await runner.executeId('/cache.js')
    await runner.executeId('/cache.js')
    expect(fetchModule).toHaveBeenCalledTimes(1)
  })
})

describe('invalidate', () => {
  it('drops cached modules and reports which ids were removed', async () => {
    fetchModule.mockResolvedValue({ code: '', file: '/i.js' })
    await runner.executeId('/inv.js')

    const removed = runner.invalidate(['/inv.js', '/never-loaded.js'])
    expect(removed.has('/inv.js')).toBe(true)
    expect(removed.has('/never-loaded.js')).toBe(false)

    // a re-execution after invalidation fetches again
    await runner.executeId('/inv.js')
    expect(fetchModule).toHaveBeenCalledTimes(2)
  })
})
