import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { createHooks } from 'hookable'
import { NuxtPerfProfiler, claimCliStartTime } from '../src/core/perf.ts'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  it('reports phases that never ended', () => {
    const perf = new NuxtPerfProfiler()
    perf.startPhase('build:bundle')

    const phase = perf.getReport().phases.find(p => p.name === 'build:bundle')

    expect(phase?.unfinished).toBe(true)
  })

  it('does not report a hook again while a phase of the same name is still open', async () => {
    const perf = new NuxtPerfProfiler()
    const hooks = createHooks<{ ready: () => Promise<void> }>()
    perf.installHookInterceptors(hooks as any)
    hooks.hook('ready', async () => { await sleep(10) })
    perf.startPhase('ready')
    await hooks.callHook('ready')

    expect(perf.getReport().phases.filter(p => p.name === 'ready')).toHaveLength(1)
  })

  it('reports time before the profiler started and time outside any phase', async () => {
    const perf = new NuxtPerfProfiler({ startTime: Date.now() - 100 })
    await sleep(30)
    perf.startPhase('config')
    await sleep(10)
    perf.endPhase('config')

    const report = perf.getReport()
    const [startup, config] = report.phases

    expect(startup!.name).toBe('startup')
    expect(startup!.duration).toBeGreaterThanOrEqual(95)
    expect(report.unattributedDuration).toBeGreaterThanOrEqual(25)
    expect(report.unattributedDuration).toBeCloseTo(report.totalDuration - startup!.duration - config!.duration, 1)
  })

  it('ends startup when the profiler is told it did', () => {
    const perf = new NuxtPerfProfiler({ startTime: Date.now() - 100, startupEndTime: performance.now() - 40 })

    const startup = perf.getReport().phases.find(p => p.name === 'startup')

    expect(startup!.duration).toBeGreaterThanOrEqual(55)
    expect(startup!.duration).toBeLessThan(65)
  })

  it('counts time covered only by sub-phases as outside any phase', async () => {
    const start = performance.now()
    const perf = new NuxtPerfProfiler()
    await sleep(25)
    perf.recordPhase('module:foo', start, start + 20)

    const report = perf.getReport()

    expect(report.unattributedDuration).toBe(report.totalDuration)
  })

  it('does not subtract overlapping child phases twice', () => {
    const perf = new NuxtPerfProfiler()
    const start = performance.now()
    perf.recordPhase('build:bundle', start, start + 50)
    perf.recordPhase('vite:client', start, start + 30)
    perf.recordPhase('vite:ssr', start + 10, start + 40)

    const bundle = perf.getReport().phases.find(p => p.name === 'build:bundle')

    expect(bundle!.ownDuration).toBe(10)
  })

  it('hands out the CLI start time once', () => {
    const startTime = Date.now() - 100
    ;(globalThis as any).__nuxt_cli__ = { startTime }
    try {
      expect(claimCliStartTime()).toBe(startTime)
      expect(claimCliStartTime()).toBeUndefined()
      ;(globalThis as any).__nuxt_cli__.startTime = startTime + 1
      expect(claimCliStartTime()).toBe(startTime + 1)
    } finally {
      delete (globalThis as any).__nuxt_cli__
    }
  })

  it('places the trace at the time the CLI started', () => {
    const startTime = Date.now() - 100
    const perf = new NuxtPerfProfiler({ startTime })

    const root = perf.getTraceEvents().find(e => e.name === 'nuxt build' && e.ph === 'B')

    expect(Math.abs(root!.ts / 1000 - startTime)).toBeLessThan(10)
  })
})
