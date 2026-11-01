import { describe, expect, it } from 'vitest'
import { NuxtPerfProfiler } from '../src/core/perf.ts'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  it.each(['resolve', 'load'] as const)('does not charge a bundler hook for the plugins it awaits through `this.%s`', async (method) => {
    const perf = new NuxtPerfProfiler()
    // stands in for the plugins the call runs, which take 50ms
    const ctx = { [method]: (id: string) => sleep(50).then(() => ({ id })) }

    const result = await perf.timeBundlerHook('delegating', 'resolveId', ctx, c => c[method]('vue'))

    expect(result).toEqual({ id: 'vue' })
    const [plugin] = perf.getReport().bundlerPlugins
    expect(plugin!.name).toBe('delegating')
    expect(plugin!.hooks.resolveId!.totalTime).toBeLessThan(25)
  })

  it('subtracts parallel `this.resolve` calls once', async () => {
    const perf = new NuxtPerfProfiler()
    const ctx = { resolve: (id: string) => sleep(50).then(() => ({ id })) }

    await perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
      await Promise.all([c.resolve('a'), c.resolve('b')])
      await sleep(30)
    })

    const time = perf.getReport().bundlerPlugins[0]!.hooks.resolveId!.totalTime
    expect(time).toBeGreaterThanOrEqual(25)
    expect(time).toBeLessThan(50)
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
