import { AsyncLocalStorage, createHook } from 'node:async_hooks'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { join } from 'pathe'
import { createHooks } from 'hookable'
import { consola } from 'consola'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import { NuxtPerfProfiler, claimCliStartTime } from '../src/core/perf.ts'

function busyWait (ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end) { /* spin */ }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('NuxtPerfProfiler', () => {
  beforeEach(() => { vi.stubEnv('NUXT_DEBUG_PERF_CPU', '0') })
  afterEach(() => { vi.unstubAllEnvs() })

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
      { name: 'vite:a', hooks: { transform: { totalTime: 7, count: 3, maxTime: 4, avgTime: 2.33, waitingTime: 0 } } },
      { name: 'nitro:b', hooks: { load: { totalTime: 1, count: 1, maxTime: 1, avgTime: 1, waitingTime: 0 } } },
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
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const profiler = new NuxtPerfProfiler()
    const hooks = createHooks<Record<string, () => void>>()
    hooks.hook('build', () => { now.mockReturnValue(performance.now() + 10) })
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

  it.each(['resolve', 'load'] as const)('does not charge a bundler hook for time spent awaiting parallel `this.%s` calls', async (method) => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const perf = new NuxtPerfProfiler()
    const settle: Array<() => void> = []
    const ctx = { [method]: (id: string) => new Promise(resolve => settle.push(() => resolve({ id }))) }

    const result = perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
      now.mockReturnValue(10)
      const a = c[method]('a')
      now.mockReturnValue(20)
      const resolved = await Promise.all([a, c[method]('b')])
      now.mockReturnValue(100)
      return resolved
    })
    now.mockReturnValue(60)
    settle[0]!()
    await flush()
    now.mockReturnValue(80)
    settle[1]!()

    expect(await result).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(perf.getReport().bundlerPlugins).toMatchObject([{ name: 'delegating', hooks: { resolveId: { totalTime: 40, count: 1 } } }])
    expect(perf.getTraceEvents().filter(e => e.ph === 'X')).toMatchObject([{ name: 'delegating:resolveId', dur: 100_000, args: { durationMs: 40 } }])
  })

  it('stops counting a bundler hook after `this.resolve` throws synchronously', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const perf = new NuxtPerfProfiler()
    const ctx = { resolve: () => { throw new Error('unresolvable') } }

    perf.timeBundlerHook('plugin', 'resolveId', ctx, (c) => {
      expect(() => c.resolve()).toThrow('unresolvable')
      now.mockReturnValue(10)
    })
    now.mockReturnValue(20)
    perf.timeBundlerHook('plugin', 'resolveId', ctx, () => { now.mockReturnValue(25) })

    expect(perf.getReport().bundlerPlugins[0]!.hooks.resolveId).toMatchObject({ totalTime: 15, count: 2 })
  })

  it('charges a bundler hook for synchronous work while `this.resolve` is pending', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const perf = new NuxtPerfProfiler()
    const settle: Array<() => void> = []
    const ctx = { resolve: () => new Promise<void>(resolve => settle.push(resolve)) }

    perf.timeBundlerHook('sync', 'resolveId', ctx, (c) => {
      void c.resolve()
      now.mockReturnValue(20)
    })
    now.mockReturnValue(30)
    const result = perf.timeBundlerHook('async', 'resolveId', ctx, (c) => {
      const resolved = c.resolve()
      now.mockReturnValue(50)
      return resolved.then(() => { now.mockReturnValue(90) })
    })
    now.mockReturnValue(80)
    settle[1]!()
    await result

    expect(Object.fromEntries(perf.getReport().bundlerPlugins.map(p => [p.name, p.hooks.resolveId!.totalTime]))).toEqual({ sync: 20, async: 30 })
  })

  it('counts overlapping calls of a bundler hook once', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const perf = new NuxtPerfProfiler()
    const settle: Array<() => void> = []
    const wait = () => new Promise<void>(resolve => settle.push(resolve))

    const first = perf.timeBundlerHook('plugin', 'load', {}, wait)
    now.mockReturnValue(20)
    const second = perf.timeBundlerHook('plugin', 'load', {}, wait)
    now.mockReturnValue(60)
    settle[1]!()
    await second
    now.mockReturnValue(100)
    settle[0]!()
    await first

    expect(perf.getReport().bundlerPlugins[0]!.hooks.load).toMatchObject({ totalTime: 100, count: 2, maxTime: 100 })
  })

  it('counts a bundler hook as running only while one of its calls is not awaiting `this.resolve`', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    onTestFinished(() => now.mockRestore())
    const perf = new NuxtPerfProfiler()
    const settle: Array<() => void> = []
    const ctx = { resolve: () => new Promise<void>(resolve => settle.push(resolve)) }

    const first = perf.timeBundlerHook('plugin', 'resolveId', ctx, async (c) => {
      now.mockReturnValue(10)
      await c.resolve()
      now.mockReturnValue(60)
    })
    now.mockReturnValue(20)
    perf.timeBundlerHook('plugin', 'resolveId', ctx, () => { now.mockReturnValue(30) })
    now.mockReturnValue(50)
    settle[0]!()
    await first
    now.mockReturnValue(70)
    perf.timeBundlerHook('plugin', 'resolveId', ctx, (c) => {
      now.mockReturnValue(75)
      void c.resolve()
    })
    now.mockReturnValue(90)
    settle[1]!()
    await flush()
    now.mockReturnValue(100)
    perf.timeBundlerHook('plugin', 'resolveId', ctx, () => { now.mockReturnValue(105) })

    expect(perf.getReport().bundlerPlugins[0]!.hooks.resolveId).toMatchObject({ totalTime: 40, count: 4, maxTime: 20 })
  })

  describe('waiting', () => {
    function mockClock () {
      const now = vi.spyOn(performance, 'now').mockReturnValue(0)
      let idle = 0
      const eventLoopUtilization = vi.spyOn(performance, 'eventLoopUtilization').mockImplementation(() => ({ idle, active: 0, utilization: 0 }))
      onTestFinished(() => {
        now.mockRestore()
        eventLoopUtilization.mockRestore()
      })
      return {
        set: (time: number) => now.mockReturnValue(time),
        idle: (time: number) => { idle = time },
      }
    }

    function deferred () {
      let settle!: () => void
      const promise = new Promise<void>((resolve) => { settle = resolve })
      return { promise, settle }
    }

    const hooks = (perf: NuxtPerfProfiler) => Object.fromEntries(perf.getReport().bundlerPlugins.flatMap(p => Object.entries(p.hooks).map(([hook, t]) => [`${p.name}:${hook}`, { totalTime: t.totalTime, waitingTime: t.waitingTime }])))

    it('counts time other hooks spend working as time a yielded hook was waiting', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      const waiting = perf.timeBundlerHook('virtual', 'load', {}, () => fs.promise)
      await flush()
      clock.set(10)
      perf.timeBundlerHook('sync', 'transform', {}, () => { clock.set(30) })
      clock.set(40)
      await perf.timeBundlerHook('async', 'transform', {}, async () => {
        await null
        clock.set(60)
      })
      clock.set(70)
      await flush()
      fs.settle()
      await waiting

      expect(hooks(perf)).toEqual({
        'virtual:load': { totalTime: 70, waitingTime: 40 },
        'sync:transform': { totalTime: 20, waitingTime: 0 },
        'async:transform': { totalTime: 20, waitingTime: 0 },
      })
      expect(perf.getTraceEvents().find(e => e.name === 'virtual:load')).toMatchObject({ dur: 70_000, args: { durationMs: 70, waitingMs: 40 } })
    })

    it('counts time the event loop was idle as waiting', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      const waiting = perf.timeBundlerHook('io', 'load', {}, () => fs.promise)
      await flush()
      clock.set(50)
      clock.idle(35)
      fs.settle()
      await waiting

      expect(hooks(perf)).toEqual({ 'io:load': { totalTime: 50, waitingTime: 35 } })
    })

    it('does not count other calls of the same hook as waiting', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      const first = perf.timeBundlerHook('plugin', 'transform', {}, () => fs.promise)
      await flush()
      clock.set(10)
      perf.timeBundlerHook('plugin', 'transform', {}, () => { clock.set(40) })
      clock.set(50)
      fs.settle()
      await first

      expect(hooks(perf)).toEqual({ 'plugin:transform': { totalTime: 50, waitingTime: 0 } })
    })

    it('does not count work after another hook yields as waiting', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = [deferred(), deferred()]

      const waiting = perf.timeBundlerHook('virtual', 'load', {}, () => fs[0]!.promise)
      await flush()
      const working = perf.timeBundlerHook('mixed', 'transform', {}, async () => {
        await fs[1]!.promise
        clock.set(40)
      })
      await flush()
      clock.set(10)
      fs[1]!.settle()
      await working
      await flush()
      clock.set(50)
      fs[0]!.settle()
      await waiting

      expect(hooks(perf)['virtual:load']).toEqual({ totalTime: 50, waitingTime: 0 })
    })

    it('does not count calls that start before another call has yielded', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      const waiting = perf.timeBundlerHook('virtual', 'load', {}, () => fs.promise)
      await flush()
      clock.set(10)
      perf.timeBundlerHook('outer', 'transform', {}, () => {
        clock.set(20)
        perf.timeBundlerHook('inner', 'transform', {}, () => { clock.set(30) })
        clock.set(40)
      })
      clock.set(50)
      fs.settle()
      await waiting

      expect(hooks(perf)['virtual:load']).toEqual({ totalTime: 50, waitingTime: 0 })
    })

    it('does not count time spent awaiting `this.resolve` as waiting', async () => {
      const clock = mockClock()
      const perf = new NuxtPerfProfiler()
      const fs = deferred()
      const nested = deferred()
      const ctx = { resolve: () => nested.promise }

      const delegating = perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
        await fs.promise
        await c.resolve()
      })
      await flush()
      clock.set(10)
      perf.timeBundlerHook('busy', 'transform', {}, () => { clock.set(30) })
      clock.set(40)
      fs.settle()
      await flush()
      clock.set(50)
      perf.timeBundlerHook('nested', 'resolveId', {}, () => { clock.set(80) })
      clock.set(90)
      nested.settle()
      await delegating

      expect(hooks(perf)['delegating:resolveId']).toEqual({ totalTime: 40, waitingTime: 20 })
      expect(perf.getTraceEvents().find(e => e.name === 'delegating:resolveId')).toMatchObject({ args: { durationMs: 40, waitingMs: 20 } })
    })

    it('lists bundler hooks by the time they were not waiting', async () => {
      const clock = mockClock()
      const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
      onTestFinished(() => log.mockRestore())
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      const waiting = perf.timeBundlerHook('virtual', 'load', {}, () => fs.promise)
      await flush()
      clock.set(10)
      perf.timeBundlerHook('busy', 'transform', {}, () => { clock.set(70) })
      perf.timeBundlerHook('busy', 'transform', {}, () => {})
      perf.timeBundlerHook('busy', 'transform', {}, () => {})
      clock.set(100)
      fs.settle()
      await waiting

      expect(perf.getReport()).toMatchObject({ bundlerPluginWaiting: 'lower-bound' })
      expect(perf.getReport().bundlerPlugins.map(p => p.name)).toEqual(['busy', 'virtual'])
      perf.printReport()
      const lines = log.mock.calls.map(([line]) => stripVTControlCharacters(String(line)))
      const hooks = lines.filter(line => line.includes(' • '))
      expect(hooks).toEqual([
        '  • busy transform - 60ms (3 calls, 20ms/file, max 60ms)',
        '  • virtual load - 40ms (1 call, 100ms total) - waiting',
      ])
    })

    it('reports how busy the main thread was while hooks were waiting', async () => {
      const clock = mockClock()
      const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
      onTestFinished(() => log.mockRestore())
      const perf = new NuxtPerfProfiler()
      const fs = deferred()

      perf.startPhase('vite:client')
      const waiting = perf.timeBundlerHook('virtual', 'load', {}, () => fs.promise)
      await flush()
      clock.set(10)
      perf.timeBundlerHook('busy', 'transform', {}, () => { clock.set(80) })
      clock.set(100)
      perf.startPhase('vite:ssr')
      clock.set(200)
      clock.idle(50)
      fs.settle()
      await waiting
      clock.set(300)
      clock.idle(150)
      perf.endPhase('vite:ssr')
      perf.endPhase('vite:client')
      perf.startPhase('nitro:build')
      await perf.timeBundlerHook('busy', 'transform', {}, async () => {
        await null
        clock.set(320)
      })
      await flush()
      clock.set(330)
      perf.endPhase('nitro:build')

      expect(perf.getReport().phases.map(p => [p.name, p.eventLoopUtilization])).toEqual([['vite:client', 1], ['vite:ssr', 0.5], ['nitro:build', undefined]])
      expect(perf.getTraceEvents().find(e => e.name === 'vite:client' && e.ph === 'E')!.args).toMatchObject({ eventLoopUtilization: 0.75 })

      perf.printReport()
      const lines = log.mock.calls.map(([line]) => stripVTControlCharacters(String(line)))
      expect(lines.find(line => line.includes('Phase'))).toMatch(/Duration\s+Main Thread/)
      expect(lines.find(line => line.includes('vite:client'))).toMatch(/vite:client\s+100ms\s+100%/)
      expect(lines.find(line => line.includes('vite:ssr'))).toMatch(/vite:ssr\s+200ms\s+50%/)
      expect(lines.find(line => line.includes('virtual load'))).toMatch(/- waiting$/)
      expect(lines.find(line => line.includes('busy transform'))).not.toMatch(/waiting/)
    })

    describe('measuring cpu time', () => {
      function cpuProfiler (Profiler = NuxtPerfProfiler) {
        vi.stubEnv('NUXT_DEBUG_PERF_CPU', undefined)
        const perf = new Profiler()
        onTestFinished(() => { perf.dispose() })
        return perf
      }

      async function importWithAsyncHooks (mock: (actual: typeof import('node:async_hooks')) => Partial<typeof import('node:async_hooks')>) {
        const actual = await vi.importActual<typeof import('node:async_hooks')>('node:async_hooks')
        vi.resetModules()
        vi.doMock('node:async_hooks', () => ({ ...actual, ...mock(actual) }))
        onTestFinished(() => {
          vi.doUnmock('node:async_hooks')
          vi.resetModules()
        })
        return (await import('../src/core/perf.ts')).NuxtPerfProfiler
      }

      it('is used by default, and the lower bound with `NUXT_DEBUG_PERF_CPU=0`', () => {
        const perf = cpuProfiler()
        perf.timeBundlerHook('plugin', 'load', {}, () => {})
        vi.stubEnv('NUXT_DEBUG_PERF_CPU', '0')
        const lowerBound = new NuxtPerfProfiler()
        lowerBound.timeBundlerHook('plugin', 'load', {}, () => {})

        expect(perf.getReport().bundlerPluginWaiting).toBe('cpu')
        expect(lowerBound.getReport().bundlerPluginWaiting).toBe('lower-bound')
      })

      it('falls back to the lower bound when `createHook` does not report promises', async () => {
        const Profiler = await importWithAsyncHooks(() => ({ createHook: () => ({ enable () { return this }, disable () { return this } }) as any }))
        const clock = mockClock()
        const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
        onTestFinished(() => log.mockRestore())
        const perf = cpuProfiler(Profiler)

        await perf.timeBundlerHook('plugin', 'load', {}, async () => {
          await null
          clock.set(10)
        })
        perf.printReport()

        const report = perf.getReport()
        expect(report.bundlerPluginWaiting).toBe('lower-bound')
        expect(report.bundlerPlugins[0]!.hooks.load).toMatchObject({ totalTime: 10, waitingTime: 0 })
        expect(log.mock.calls.map(([line]) => stripVTControlCharacters(String(line)))).toContain('  Hooks are listed by total time, leaving out a lower bound of the time they were waiting.')
      })

      it('does not throw from async hooks for resources that cannot be read or written', async () => {
        const Profiler = await importWithAsyncHooks(actual => ({
          createHook: callbacks => actual.createHook({
            ...callbacks,
            init: (asyncId, type, triggerAsyncId, resource) => callbacks.init!(asyncId, type, triggerAsyncId, resource instanceof Promise ? resource : Object.freeze({})),
          }),
          executionAsyncResource: () => new Proxy({}, { get () { throw new Error('unreadable') } }),
        }))
        const clock = mockClock()
        const perf = cpuProfiler(Profiler)

        await perf.timeBundlerHook('plugin', 'load', {}, async () => {
          clock.set(10)
          await new Promise(resolve => setImmediate(resolve))
          clock.set(30)
        })

        expect(perf.getReport().bundlerPlugins[0]!.hooks.load).toMatchObject({ totalTime: 30, cpuTime: 10 })
      })

      it('keeps `AsyncLocalStorage` context through tracked hooks', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()
        const storage = new AsyncLocalStorage<string>()

        const store = await storage.run('outer', () => perf.timeBundlerHook('plugin', 'load', {}, async () => {
          clock.set(10)
          await new Promise(resolve => setImmediate(resolve))
          clock.set(30)
          return storage.getStore()
        }))

        expect(store).toBe('outer')
        expect(perf.getReport().bundlerPlugins[0]!.hooks.load).toMatchObject({ totalTime: 30, cpuTime: 30 })
      })

      it('does not count time against objects it did not create', async () => {
        const foreign = { cpuTime: 0, done: false }
        const Profiler = await importWithAsyncHooks(() => ({ executionAsyncResource: () => new Proxy({}, { get: () => foreign }) }))
        const clock = mockClock()
        const perf = cpuProfiler(Profiler)

        await perf.timeBundlerHook('plugin', 'load', {}, async () => {
          await new Promise(resolve => setImmediate(resolve))
          clock.set(30)
        })
        clock.set(40)
        await flush()

        expect(foreign.cpuTime).toBe(0)
      })

      it('counts overlapping calls once in the total and sums their own time', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()
        const fs = [deferred(), deferred()]

        const first = perf.timeBundlerHook('plugin', 'transform', {}, async () => {
          clock.set(10)
          await fs[0]!.promise
          clock.set(110)
        })
        clock.set(20)
        const second = perf.timeBundlerHook('plugin', 'transform', {}, async () => {
          clock.set(30)
          await fs[1]!.promise
          clock.set(70)
        })
        await flush()
        clock.set(60)
        fs[1]!.settle()
        await second
        clock.set(100)
        fs[0]!.settle()
        await first

        expect(perf.getReport().bundlerPlugins[0]!.hooks.transform).toEqual({ totalTime: 110, count: 2, maxTime: 110, avgTime: 55, cpuTime: 40, waitingTime: 70 })
      })

      const cpu = (perf: NuxtPerfProfiler) => Object.fromEntries(perf.getReport().bundlerPlugins.flatMap(p => Object.entries(p.hooks).map(([hook, t]) => [`${p.name}:${hook}`, t.cpuTime])))

      it('counts work a hook does after it resumes, even inside another hook\'s turn', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()
        const shared = deferred()
        const fs = deferred()

        const resumed = perf.timeBundlerHook('resumed', 'load', {}, async () => {
          await shared.promise
          clock.set(60)
          await fs.promise
        })
        await flush()
        clock.set(10)
        await perf.timeBundlerHook('other', 'transform', {}, async () => {
          await null
          clock.set(20)
          shared.settle()
        })
        await flush()
        clock.set(70)
        fs.settle()
        await resumed

        expect(cpu(perf)).toEqual({ 'resumed:load': 40, 'other:transform': 10 })
      })

      it('counts work after timers as the hook\'s own', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()

        await perf.timeBundlerHook('timer', 'load', {}, async () => {
          clock.set(10)
          await new Promise(resolve => setImmediate(resolve))
          clock.set(30)
          await new Promise(resolve => setTimeout(resolve))
          clock.set(60)
        })

        expect(cpu(perf)).toEqual({ 'timer:load': 60 })
      })

      it('does not count hooks run by `this.resolve` as the caller\'s', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()
        const ctx = {
          resolve: () => Promise.resolve().then(() => perf.timeBundlerHook('nested', 'resolveId', {}, () => { clock.set(40) })),
        }

        await perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
          clock.set(10)
          await c.resolve()
          clock.set(50)
        })

        expect(cpu(perf)).toEqual({ 'delegating:resolveId': 20, 'nested:resolveId': 30 })
      })

      it('stops counting once disposed', async () => {
        const clock = mockClock()
        const disable = vi.spyOn(Object.getPrototypeOf(createHook({})), 'disable')
        onTestFinished(() => disable.mockRestore())
        const perf = cpuProfiler()
        perf.timeBundlerHook('before', 'load', {}, () => { clock.set(10) })
        perf.dispose()
        expect(disable).toHaveBeenCalledOnce()

        await perf.timeBundlerHook('after', 'load', {}, async () => {
          await null
          clock.set(20)
        })

        expect(cpu(perf)).toEqual({ 'before:load': 10, 'after:load': undefined })
      })

      it('stops tracking when nuxt closes', async () => {
        const disable = vi.spyOn(Object.getPrototypeOf(createHook({})), 'disable')
        const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
        const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-perf-'))
        onTestFinished(async () => {
          disable.mockRestore()
          log.mockRestore()
          await rm(buildDir, { recursive: true, force: true })
        })
        const perf = cpuProfiler()
        const hooks = createHooks<Record<string, () => void>>()
        perf.attach({ hooks, hook: hooks.hook, options: { dev: true, debug: { perf: 'quiet' }, buildDir } } as unknown as Nuxt)
        const clock = mockClock()
        perf.timeBundlerHook('before', 'load', {}, () => { clock.set(10) })

        await hooks.callHook('close')
        await perf.timeBundlerHook('after', 'load', {}, async () => {
          await null
          clock.set(20)
        })

        expect(disable).toHaveBeenCalledOnce()
        expect(cpu(perf)).toEqual({ 'before:load': 10, 'after:load': undefined })
      })

      it('lists and marks hooks by cpu time', async () => {
        const clock = mockClock()
        const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
        onTestFinished(() => log.mockRestore())
        const perf = cpuProfiler()
        const fs = [deferred(), deferred()]

        const waiting = perf.timeBundlerHook('waiting', 'load', {}, () => {
          clock.set(10)
          return fs[0]!.promise
        })
        await flush()
        const mixed = perf.timeBundlerHook('mixed', 'transform', {}, async () => {
          await fs[1]!.promise
          clock.set(60)
        })
        await flush()
        fs[1]!.settle()
        await mixed
        await flush()
        clock.set(70)
        fs[0]!.settle()
        await waiting

        const report = perf.getReport()
        expect(report.bundlerPluginWaiting).toBe('cpu')
        expect(report.bundlerPlugins.map(p => p.name)).toEqual(['mixed', 'waiting'])
        perf.printReport()
        const lines = log.mock.calls.map(([line]) => stripVTControlCharacters(String(line)))
        expect(lines.filter(line => line.includes(' \u2022 '))).toEqual([
          '  \u2022 mixed transform - 50ms (1 call)',
          '  \u2022 waiting load - 10ms (1 call, 70ms total) - waiting',
        ])
        expect(lines).toContain('  waiting: for at least half its time the hook was not running its own code')
      })

      it('counts time awaiting `this.resolve` as waiting', async () => {
        const clock = mockClock()
        const perf = cpuProfiler()
        const nested = deferred()
        const ctx = { resolve: () => nested.promise }

        const delegating = perf.timeBundlerHook('delegating', 'resolveId', ctx, async (c) => {
          clock.set(10)
          await c.resolve()
          clock.set(60)
        })
        await flush()
        clock.set(20)
        perf.timeBundlerHook('nested', 'resolveId', {}, () => { clock.set(40) })
        clock.set(50)
        nested.settle()
        await delegating

        expect(perf.getReport().bundlerPlugins.find(p => p.name === 'delegating')!.hooks.resolveId).toMatchObject({ totalTime: 60, cpuTime: 20, waitingTime: 40 })
      })

      it('stops tracking when the process exits after a failed build', async () => {
        const disable = vi.spyOn(Object.getPrototypeOf(createHook({})), 'disable')
        const buildDir = await mkdtemp(join(tmpdir(), 'nuxt-perf-'))
        onTestFinished(async () => {
          disable.mockRestore()
          await rm(buildDir, { recursive: true, force: true })
        })
        const perf = cpuProfiler()
        const hooks = createHooks<Record<string, () => void>>()
        const exitListeners = process.listeners('exit')
        perf.attach({ hooks, hook: hooks.hook, options: { dev: false, debug: { perf: 'quiet' }, buildDir } } as unknown as Nuxt)
        const onExit = process.listeners('exit').find(listener => !exitListeners.includes(listener))!
        onTestFinished(() => { process.off('exit', onExit) })
        perf.startPhase('vite:client')
        perf.timeBundlerHook('plugin', 'load', {}, () => {})

        onExit(1)

        expect(disable).toHaveBeenCalledOnce()
        expect(existsSync(join(buildDir, 'perf-report.json'))).toBe(true)
      })
    })
  })

  it('keeps the rest of the plugin context working', () => {
    const perf = new NuxtPerfProfiler()
    class Context {
      #environment = 'client'
      get environment () { return this.#environment }
      set environment (value) { this.#environment = value }
      getEnvironment () { return this.#environment }
    }

    expect(perf.timeBundlerHook('plugin', 'load', new Context(), (c) => {
      c.environment = 'ssr'
      return [c.environment, c.getEnvironment()]
    })).toEqual(['ssr', 'ssr'])
  })

  it('leaves read-only plugin context methods unwrapped', () => {
    const perf = new NuxtPerfProfiler()
    const ctx = Object.freeze({ resolve: () => 'resolved', getModuleIds: () => ['entry.ts'] })

    expect(perf.timeBundlerHook('plugin', 'load', ctx, c => [c.resolve(), c.getModuleIds === ctx.getModuleIds])).toEqual(['resolved', true])
  })

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

    const ready = perf.getReport().phases.filter(p => p.name === 'ready')
    expect(ready).toHaveLength(1)
    expect(ready[0]).toMatchObject({ unfinished: true })
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

  it('does not report memory for phases that ran before the profiler was created', () => {
    const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
    onTestFinished(() => log.mockRestore())
    const perf = new NuxtPerfProfiler({ startTime: Date.now() - 100 })

    perf.printReport()

    const startup = log.mock.calls.map(([line]) => stripVTControlCharacters(String(line))).find(line => line.includes('startup'))
    expect(startup).toMatch(/startup\s+\S+\s+-\s+-/)
    expect(perf.getTraceEvents().filter(e => e.cat === 'memory')).toEqual([])
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

  it('keeps the time of a module phase in the row of the phase it runs in', async () => {
    const perf = new NuxtPerfProfiler()
    const start = performance.now()
    await sleep(60)
    perf.recordPhase('modules', start, start + 50)
    perf.recordPhase('module:foo', start + 10, start + 30)

    const report = perf.getReport()

    expect(report.phases.find(p => p.name === 'modules')!.ownDuration).toBeCloseTo(50, 1)
    expect(report.unattributedDuration).toBeCloseTo(report.totalDuration - 50, 1)
  })

  it('shows phases that never ended in the table and the trace', async () => {
    const log = vi.spyOn(consola, 'log').mockImplementation(() => {})
    onTestFinished(() => log.mockRestore())
    const perf = new NuxtPerfProfiler()
    perf.startPhase('build:bundle')
    await sleep(20)

    perf.printReport()
    const events = perf.getTraceEvents()

    const row = log.mock.calls.map(([line]) => stripVTControlCharacters(String(line))).find(line => line.includes('build:bundle'))
    expect(row).toMatch(/unfinished$/)
    const begin = events.find(e => e.cat === 'phase' && e.name === 'build:bundle' && e.ph === 'B')!
    const end = events.find(e => e.cat === 'phase' && e.name === 'build:bundle' && e.ph === 'E')!
    expect(end.ts - begin.ts).toBeGreaterThanOrEqual(19_000)
    expect(end.ts).toBe(events.find(e => e.name === 'nuxt build' && e.ph === 'E')!.ts)
  })

  it('counts time shared by overlapping phases once', async () => {
    const perf = new NuxtPerfProfiler()
    const start = performance.now()
    await sleep(60)
    perf.recordPhase('build:bundle', start, start + 50)
    perf.recordPhase('vite:client', start, start + 30)
    perf.recordPhase('vite:ssr', start + 10, start + 40)

    const report = perf.getReport()
    const own = Object.fromEntries(report.phases.map(p => [p.name, p.ownDuration]))

    expect(own).toEqual({ 'build:bundle': 10, 'vite:client': 10, 'vite:ssr': 30 })
    expect(own['build:bundle']! + own['vite:client']! + own['vite:ssr']! + report.unattributedDuration).toBeCloseTo(report.totalDuration, 1)
  })

  it('counts phases that start and end together once', async () => {
    const perf = new NuxtPerfProfiler()
    const start = performance.now()
    await sleep(30)
    perf.recordPhase('build:bundle', start, start + 20)
    perf.recordPhase('a', start, start + 20)
    perf.recordPhase('b', start, start + 20)

    const report = perf.getReport()
    const rows = report.phases.reduce((sum, p) => sum + p.ownDuration, 0)

    expect(rows).toBeCloseTo(20, 1)
    expect(rows + report.unattributedDuration).toBeCloseTo(report.totalDuration, 1)
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
