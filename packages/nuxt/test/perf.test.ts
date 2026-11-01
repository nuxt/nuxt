import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { consola } from 'consola'
import { describe, expect, it, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { NuxtPerfProfiler } from '../src/core/perf.ts'

function busyWait (ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end) { /* spin */ }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  it('reports phases, own time, modules and bundler plugins', async () => {
    const profiler = new NuxtPerfProfiler()
    const hooks = createHooks<Record<string, () => void>>()
    hooks.hook('slow', () => busyWait(60))
    hooks.hook('nested', () => busyWait(10))
    profiler.installHookInterceptors(hooks as any)

    profiler.startPhase('modules')
    profiler.startPhase('module:foo')
    busyWait(5)
    profiler.endPhase('module:foo')
    await hooks.callHook('nested')
    profiler.endPhase('modules')
    await hooks.callHook('slow')

    profiler.collectModuleTimings([{ meta: { name: 'foo' }, timings: { setup: 3 } }, { timings: { setup: 8 } }, { meta: { name: 'no-timing' } }])
    const start = performance.now()
    profiler.recordBundlerPluginHook('vite:a', 'transform', 2, start)
    profiler.recordBundlerPluginHook('vite:a', 'transform', 4, start + 10)
    profiler.recordBundlerPluginHook('vite:a', 'transform', 1, start + 11)
    profiler.recordBundlerPluginHook('nitro:b', 'load', 1, performance.now())

    const report = profiler.getReport()
    expect(report.phases.map(p => p.name)).toEqual(['modules', 'module:foo', 'nested', 'slow'])
    const modules = report.phases.find(p => p.name === 'modules')!
    expect(modules.ownDuration).toBeLessThan(modules.duration)
    expect(report.modules).toEqual([{ name: '(anonymous)', setupTime: 8 }, { name: 'foo', setupTime: 3 }])
    expect(report.bundlerPlugins).toEqual([
      { name: 'vite:a', hooks: { transform: { totalTime: 7, count: 3, maxTime: 4, avgTime: 2.33 } } },
      { name: 'nitro:b', hooks: { load: { totalTime: 1, count: 1, maxTime: 1, avgTime: 1 } } },
    ])

    const events = profiler.getTraceEvents()
    const names = (cat: string) => events.filter(e => e.cat === cat).map(e => `${e.ph}:${e.name}`)
    expect(names('phase')).toEqual(['B:module:foo', 'E:module:foo', 'B:modules', 'E:modules'])
    expect(names('hook')).toEqual(['B:nested', 'E:nested', 'B:slow', 'E:slow'])
    expect(names('Vite Plugins')).toEqual(['X:vite:a:transform', 'X:vite:a:transform', 'X:vite:a:transform'])
    expect(names('Nitro Plugins')).toEqual(['X:nitro:b:load'])
    expect(events.filter(e => e.name === 'thread_name').map(e => `${e.tid}:${e.args!.name}`)).toEqual(['1:Build', '2:Hooks', '10:Vite Plugins 1', '11:Vite Plugins 2', '110:Nitro Plugins'])
    profiler.dispose()
  })

  it('only shows hooks as phases when not covered by a phase of the same name, until disposed', async () => {
    const profiler = new NuxtPerfProfiler()
    const hooks = createHooks<Record<string, () => void>>()
    hooks.hook('build', () => busyWait(10))
    hooks.hook('fast', () => {})
    profiler.installHookInterceptors(hooks as any)
    profiler.startPhase('build')
    await hooks.callHook('build')
    await hooks.callHook('fast')
    profiler.endPhase('build')
    profiler.dispose()
    await hooks.callHook('build')
    expect(profiler.getReport().phases.map(p => p.name)).toEqual(['build'])
  })

  it('writes the report and trace to the build directory', async () => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-perf-'))
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const profiler = new NuxtPerfProfiler()
      profiler.startPhase('init')
      profiler.endPhase()
      profiler.printReport({ title: 'Test Report' })
      const reportPath = profiler.writeReport(buildDir, { quiet: true })
      expect(JSON.parse(await readFile(reportPath, 'utf-8')).phases[0].name).toBe('init')
      expect(JSON.parse(await readFile(join(buildDir, 'perf-trace.json'), 'utf-8')).traceEvents.length).toBeGreaterThan(0)
    } finally {
      log.mockRestore()
      await rm(buildDir, { recursive: true, force: true })
    }
  })

  it.each([
    [{ dev: true, debug: { perf: true } }, 'Nuxt Performance Report'],
    [{ dev: false, debug: { perf: true } }, 'Nuxt Build Performance'],
    [{ dev: true, debug: { perf: 'quiet' } }, undefined],
  ])('flushes the report once on close when attached with %o', async (options, title) => {
    const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-perf-'))
    const exitListeners = process.listenerCount('exit')
    const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
    const profiler = new NuxtPerfProfiler()
    const print = vi.spyOn(profiler, 'printReport')
    const write = vi.spyOn(profiler, 'writeReport')
    const hooks = createHooks<Record<string, () => void>>()
    const nuxt = { hooks, hook: hooks.hook, options: { ...options, buildDir } } as unknown as Nuxt
    try {
      profiler.attach(nuxt)
      expect(nuxt._perf).toBe(profiler)
      expect(process.listenerCount('exit')).toBe(exitListeners + 1)

      await hooks.callHook('close')
      await hooks.callHook('close')

      expect(process.listenerCount('exit')).toBe(exitListeners)
      expect(print.mock.calls).toEqual(title ? [[{ title }]] : [])
      expect(write).toHaveBeenCalledOnce()
      expect(log.mock.calls.length > 0).toBe(!!title)
      expect(existsSync(join(buildDir, 'perf-report.json'))).toBe(true)
    } finally {
      log.mockRestore()
      await rm(buildDir, { recursive: true, force: true })
    }
  })

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
