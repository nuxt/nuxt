import { describe, expect, it } from 'vitest'
import { NuxtPerfProfiler } from '../src/core/perf.ts'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  it('reports phases that never ended', () => {
    const perf = new NuxtPerfProfiler()
    perf.startPhase('build:bundle')

    const phase = perf.getReport().phases.find(p => p.name === 'build:bundle')

    expect(phase?.unfinished).toBe(true)
  })

  it('reports time before the profiler started and time outside any phase', async () => {
    const perf = new NuxtPerfProfiler({ startTime: Date.now() - 100 })
    await sleep(30)
    perf.startPhase('config')
    perf.endPhase('config')

    const report = perf.getReport()

    expect(report.phases[0]!.name).toBe('startup')
    expect(report.phases[0]!.duration).toBeGreaterThanOrEqual(95)
    expect(report.unattributedDuration).toBeGreaterThanOrEqual(25)
    expect(report.unattributedDuration).toBeLessThan(report.totalDuration - report.phases[0]!.duration)
  })

  it('places the trace at the time the CLI started', () => {
    const startTime = Date.now() - 100
    const perf = new NuxtPerfProfiler({ startTime })

    const root = perf.getTraceEvents().find(e => e.name === 'nuxt build' && e.ph === 'B')

    expect(Math.abs(root!.ts / 1000 - startTime)).toBeLessThan(10)
  })
})
