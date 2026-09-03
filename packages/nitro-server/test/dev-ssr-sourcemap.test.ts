import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EvaluatedModules } from 'vite/module-runner'
import type { NitroApp } from 'nitro/types'

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))

const { default: plugin } = await import('../src/runtime/plugins/dev-ssr-sourcemap.ts')

function withEnvs (envs: unknown) {
  ;(globalThis as Record<string, any>).__nitro_vite_envs__ = envs
  const nitroApp = {} as NitroApp
  ;(plugin as (app: NitroApp) => void)(nitroApp)
  return nitroApp.ssrSourceMaps!
}

/** A module runner graph holding one evaluated module with an inline sourcemap. */
function evaluatedModules (id: string, source: string, mappings = 'AAAA') {
  const modules = new EvaluatedModules()
  const node = modules.ensureModule(id, id)
  const map = { version: 3, sources: [source], names: [], mappings }
  node.meta = {
    id,
    url: id,
    file: node.file,
    code: `export const x = 1\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`,
    invalidate: false,
  }
  return modules
}

afterEach(() => {
  delete (globalThis as Record<string, any>).__nitro_vite_envs__
})

describe('dev ssr sourcemap plugin', () => {
  it('returns the evaluated code of a module in any environment', () => {
    const api = withEnvs({
      nitro: { runner: { evaluatedModules: evaluatedModules('/src/server.ts', '/src/server.ts') } },
      ssr: { runner: { evaluatedModules: evaluatedModules('/src/useBoom.ts', '/src/useBoom.ts') } },
    })

    expect(api.getCode('/src/useBoom.ts')).toMatch(/^export const x = 1\n\/\/# sourceMappingURL=data:application\/json;base64,/)
    expect(api.getCode('/src/server.ts')).toMatch(/^export const x = 1\n/)
    expect(api.getCode('/src/unknown.ts')).toBeUndefined()
    expect(withEnvs(undefined).getCode('/src/useBoom.ts')).toBeUndefined()
  })

  it('finds a module by file when its id carries a query', () => {
    const api = withEnvs({
      ssr: { runner: { evaluatedModules: evaluatedModules('/src/useBoom.ts?v=1', '/src/useBoom.ts') } },
    })

    expect(api.getCode('/src/useBoom.ts')).toMatch(/^export const x = 1\n/)
  })

  it('returns the generated position a source position was mapped from', () => {
    const api = withEnvs({
      // two wrapper lines ahead of the module's own first line
      ssr: { runner: { evaluatedModules: evaluatedModules('/src/useBoom.ts', '/src/useBoom.ts', ';;AAAA;AACA') } },
    })

    expect(api.getCompiledPosition!('/src/useBoom.ts', 2, 1)).toEqual({ file: '/src/useBoom.ts', line: 4, column: 1 })
    expect(api.getCompiledPosition!('/src/useBoom.ts', 9, 1)).toBeUndefined()
    expect(api.getCompiledPosition!('/src/unknown.ts', 1, 1)).toBeUndefined()
  })

  it('takes the evaluator\'s own lines back off the generated position', () => {
    const api = withEnvs({
      ssr: { runner: { evaluatedModules: evaluatedModules('/src/useBoom.ts', '/src/useBoom.ts', ';;AAAA;AACA'), evaluator: { startOffset: 3 } } },
    })

    // the map is shifted by the wrapper, so source line 1 sits on generated line 3 of the wrapped code
    expect(api.getCompiledPosition!('/src/useBoom.ts', 2, 1)).toEqual({ file: '/src/useBoom.ts', line: 1, column: 1 })
    expect(api.getCompiledPosition!('/src/useBoom.ts', 1, 1)).toBeUndefined()
  })

  it('finds the module a source position was inlined into', () => {
    const api = withEnvs({
      ssr: { runner: { evaluatedModules: evaluatedModules('/src/entry.ts', '../app/useBoom.ts', 'AAAA') } },
    })

    expect(api.getCompiledPosition!('/app/useBoom.ts', 1, 1)).toEqual({ file: '/src/entry.ts', line: 1, column: 1 })
  })

  it('declares that stacks arrive already mapped', () => {
    expect(withEnvs({}).stacksAreMapped).toBe(true)
  })

  it('does not throw when no runner is registered', () => {
    expect(withEnvs(undefined).getCompiledPosition!('/src/useBoom.ts', 1, 1)).toBeUndefined()
    expect(withEnvs({ ssr: {} }).getCompiledPosition!('/src/useBoom.ts', 1, 1)).toBeUndefined()
  })
})
