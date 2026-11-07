import { describe, expect, it } from 'vitest'
import { NuxtPerfProfiler } from '../src/core/perf.ts'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  it.each(['resolve', 'load'] as const)('does not charge a bundler hook for the plugins it awaits through `this.%s`', async (method) => {
    const perf = new NuxtPerfProfiler()
    // stands in for the plugins the call runs, which take 50ms
    const ctx = { [method]: (id: string) => sleep(50).then(() => ({ id })) }

    const result = await perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
      // parallel calls are subtracted once
      const resolved = await Promise.all([c[method]('a'), c[method]('b')])
      await sleep(30)
      return resolved
    })

    expect(result).toEqual([{ id: 'a' }, { id: 'b' }])
    const [plugin] = perf.getReport().bundlerPlugins
    expect(plugin!.name).toBe('delegating')
    expect(plugin!.hooks.resolveId!.totalTime).toBeGreaterThanOrEqual(25)
    expect(plugin!.hooks.resolveId!.totalTime).toBeLessThan(50)
  })

  it('keeps the rest of the plugin context working', async () => {
    const perf = new NuxtPerfProfiler()
    class Context {
      #environment = 'ssr'
      getEnvironment () { return this.#environment }
    }

    expect(await perf.timeBundlerHook('plugin', 'load', new Context(), c => c.getEnvironment())).toBe('ssr')
  })
})
