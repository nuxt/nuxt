import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'pathe'
import { consola } from 'consola'
import { link } from 'clickable-path'
import { colors } from 'consola/utils'
import type { NuxtHookRegistry } from '@nuxt/schema'
import type { Nuxt, NuxtHooks } from 'nuxt/schema'

interface MemorySnapshot {
  rss: number
  heapUsed: number
  heapTotal: number
}

interface MemoryDelta {
  rss: number
  heapUsed: number
}

interface PerfPhase {
  name: string
  startTime: number
  endTime: number
  duration: number
  memoryBefore: MemorySnapshot
  memoryAfter: MemorySnapshot
  memoryDelta: MemoryDelta
  retainedMemory?: MemorySnapshot
}

interface OpenPhase {
  name: string
  startTime: number
  memoryBefore: MemorySnapshot
}

interface ModuleTiming {
  name: string
  setupTime: number
}

interface PluginHookTiming {
  totalTime: number
  count: number
  maxTime: number
  avgTime: number
}

interface PluginSpan {
  pluginName: string
  hookName: string
  startTime: number
  durationMs: number
}

interface PerfReport {
  totalDuration: number
  totalMemoryDelta: MemoryDelta
  hasGCSnapshots: boolean
  phases: Array<{
    name: string
    duration: number
    ownDuration: number
    memoryBefore: MemorySnapshot
    memoryAfter: MemorySnapshot
    memoryDelta: MemoryDelta
    ownMemoryDelta: MemoryDelta
    retainedHeap?: number
  }>
  modules: ModuleTiming[]
  bundlerPlugins: Array<{ name: string, hooks: Record<string, PluginHookTiming> }>
  timestamp: string
}

/** Chrome Trace Event format (subset used by Perfetto / chrome://tracing), timestamps in microseconds */
interface TraceEvent {
  name: string
  cat: string
  /** 'B'/'E' = begin/end, 'X' = complete, 'M' = metadata, 'C' = counter */
  ph: string
  ts: number
  dur?: number
  pid: number
  tid: number
  args?: Record<string, unknown>
}

const hasGC = typeof globalThis.gc === 'function'

function getMemorySnapshot (): MemorySnapshot {
  const mem = process.memoryUsage()
  return { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal }
}

function getDelta (before: MemorySnapshot, after: MemorySnapshot): MemoryDelta {
  return { rss: after.rss - before.rss, heapUsed: after.heapUsed - before.heapUsed }
}

function formatBytes (bytes: number): string {
  const abs = Math.abs(bytes)
  if (abs < 1024) { return `${bytes} B` }
  if (abs < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB` }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatSignedBytes (bytes: number): string {
  return (bytes >= 0 ? '+' : '') + formatBytes(bytes)
}

function formatDuration (ms: number): string {
  if (ms < 1) { return `${Math.round(ms * 1000)}µs` }
  if (ms < 1000) { return `${Math.round(ms)}ms` }
  if (ms < 60_000) { return `${(ms / 1000).toFixed(1)}s` }
  return `${(ms / 60_000).toFixed(1)}min`
}

function thresholdColor (value: number, red: number, yellow: number, fallback: (text: string) => string = colors.dim) {
  return value > red ? colors.red : value > yellow ? colors.yellow : fallback
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g

function pad (str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const diff = width - str.replace(ANSI_RE, '').length
  if (diff <= 0) { return str }
  const padding = ' '.repeat(diff)
  return align === 'right' ? padding + str : str + padding
}

function round (n: number): number {
  return Math.round(n * 100) / 100
}

function contains (outer: { startTime: number, endTime: number }, inner: { startTime: number, endTime: number }) {
  return inner.startTime >= outer.startTime && inner.endTime <= outer.endTime
}

/** Hooks taking at least this long are shown alongside the phases. */
const HOOK_PHASE_THRESHOLD_MS = 5

export class NuxtPerfProfiler {
  #phases: PerfPhase[] = []
  #phaseStack: OpenPhase[] = []
  #hookPhases: PerfPhase[] = []
  #hookStartStack: OpenPhase[] = []
  #modules: ModuleTiming[] = []
  #bundlerPluginTimings = new Map<string, Map<string, { totalTime: number, count: number, maxTime: number }>>()
  #bundlerPluginSpans: PluginSpan[] = []
  #globalStart: number
  #globalMemoryBefore: MemorySnapshot
  #unsubscribe?: () => void
  /** Offset to convert performance.now() (ms) to epoch microseconds for trace events */
  #baseTs: number

  constructor (options?: { startTime?: number }) {
    // `startTime` is a `Date.now()` timestamp
    this.#globalStart = options?.startTime ? performance.now() - (Date.now() - options.startTime) : performance.now()
    this.#globalMemoryBefore = getMemorySnapshot()
    this.#baseTs = Date.now() * 1000 - this.#globalStart * 1000
  }

  /**
   * Profile `nuxt`, printing and writing the report when it closes (or the process exits).
   */
  attach (nuxt: Nuxt): void {
    nuxt._perf = this
    this.installHookInterceptors(nuxt.hooks)

    const quiet = typeof nuxt.options.debug === 'object' && nuxt.options.debug.perf === 'quiet'
    const title = nuxt.options.dev ? 'Nuxt Performance Report' : 'Nuxt Build Performance'

    let flushed = false
    const flush = () => {
      if (flushed) { return }
      flushed = true
      if (!quiet) { this.printReport({ title }) }
      this.writeReport(nuxt.options.buildDir, { quiet })
      this.dispose()
    }

    nuxt.hook('close', flush)
    process.once('exit', flush)
    nuxt.hook('close', () => { process.off('exit', flush) })
  }

  installHookInterceptors (hooks: NuxtHookRegistry<NuxtHooks>): void {
    const unsubBefore = hooks.beforeEach((event) => {
      this.#hookStartStack.push({ name: event.name, startTime: performance.now(), memoryBefore: getMemorySnapshot() })
    })

    const unsubAfter = hooks.afterEach((event) => {
      const startIdx = this.#hookStartStack.findLastIndex(h => h.name === event.name)
      if (startIdx === -1) { return }
      this.#hookPhases.push(this.#close(this.#hookStartStack.splice(startIdx, 1)[0]!))
    })

    this.#unsubscribe = () => {
      unsubBefore()
      unsubAfter()
    }
  }

  startPhase (name: string): void {
    this.#phaseStack.push({ name, startTime: performance.now(), memoryBefore: getMemorySnapshot() })
  }

  endPhase (name?: string): void {
    const phaseIdx = name ? this.#phaseStack.findLastIndex(p => p.name === name) : this.#phaseStack.length - 1
    if (phaseIdx < 0) { return }

    const phase = this.#close(this.#phaseStack.splice(phaseIdx, 1)[0]!)

    // A GC'd snapshot measures truly retained memory. It is expensive, so it is only taken at
    // top-level phase boundaries, and only when `--expose-gc` is available.
    if (this.#phaseStack.length === 0 && hasGC) {
      globalThis.gc!()
      phase.retainedMemory = getMemorySnapshot()
    }

    this.#phases.push(phase)
  }

  #close (open: OpenPhase): PerfPhase {
    const endTime = performance.now()
    const memoryAfter = getMemorySnapshot()
    return {
      name: open.name,
      startTime: open.startTime,
      endTime,
      duration: round(endTime - open.startTime),
      memoryBefore: open.memoryBefore,
      memoryAfter,
      memoryDelta: getDelta(open.memoryBefore, memoryAfter),
    }
  }

  recordBundlerPluginHook (pluginName: string, hookName: string, durationMs: number, startTime?: number): void {
    let plugin = this.#bundlerPluginTimings.get(pluginName)
    if (!plugin) {
      plugin = new Map()
      this.#bundlerPluginTimings.set(pluginName, plugin)
    }
    const entry = plugin.get(hookName)
    if (entry) {
      entry.totalTime += durationMs
      entry.count++
      entry.maxTime = Math.max(entry.maxTime, durationMs)
    } else {
      plugin.set(hookName, { totalTime: durationMs, count: 1, maxTime: durationMs })
    }
    if (startTime != null && durationMs > 0.1) {
      this.#bundlerPluginSpans.push({ pluginName, hookName, startTime, durationMs })
    }
  }

  /**
   * Runs a bundler plugin hook with a proxy of `ctx` as its plugin context and records how long it took.
   *
   * Time spent awaiting `this.resolve()` or `this.load()` is left out, as those calls run other
   * plugins' hooks, which are recorded separately.
   */
  timeBundlerHook<T> (pluginName: string, hookName: string, ctx: unknown, run: (ctx: any) => T): T {
    const start = performance.now()
    // parallel calls overlap, so subtract how long at least one of them was pending
    let pending = 0
    let pendingSince = 0
    let nested = 0
    const exit = () => {
      if (--pending === 0) { nested += performance.now() - pendingSince }
    }
    const proxy = ctx && typeof ctx === 'object'
      ? new Proxy(ctx, {
          get (target, key) {
            const value = Reflect.get(target, key, target)
            if (typeof value !== 'function') { return value }
            // bound so that methods relying on private fields or native receivers still work
            if (key !== 'resolve' && key !== 'load') { return value.bind(target) }
            return (...args: unknown[]) => {
              if (pending++ === 0) { pendingSince = performance.now() }
              try {
                return Promise.resolve(value.apply(target, args)).finally(exit)
              } catch (err) {
                exit()
                throw err
              }
            }
          },
          set: (target, key, value) => Reflect.set(target, key, value),
        })
      : ctx
    const record = () => {
      const end = performance.now()
      this.recordBundlerPluginHook(pluginName, hookName, end - start - nested - (pending > 0 ? end - pendingSince : 0), start)
    }
    try {
      const result = run(proxy)
      if (result && typeof result === 'object' && 'then' in result) {
        return (result as unknown as Promise<unknown>).finally(record) as T
      }
      record()
      return result
    } catch (err) {
      record()
      throw err
    }
  }

  collectModuleTimings (installedModules: Array<{ meta?: { name?: string }, timings?: Record<string, number | undefined> }>): void {
    for (const mod of installedModules) {
      const setupTime = mod.timings?.setup
      if (setupTime != null) {
        this.#modules.push({ name: mod.meta?.name || '(anonymous)', setupTime })
      }
    }
  }

  getReport (): PerfReport {
    const totalDuration = round(performance.now() - this.#globalStart)

    // hook invocations above the threshold are shown as phases unless a manual phase of the same
    // name already covers them
    const allPhases: PerfPhase[] = [
      ...this.#phases,
      ...this.#hookPhases.filter(hp => hp.duration >= HOOK_PHASE_THRESHOLD_MS && !this.#phases.some(p => p.name === hp.name && contains(p, hp))),
    ].sort((a, b) => a.startTime - b.startTime)

    // own time and memory exclude direct children (phases nested in this one but in no other child)
    function computeOwn (phase: PerfPhase) {
      const children = allPhases.filter(other => other !== phase && contains(phase, other))
      const directChildren = children.filter(child => !children.some(other => other !== child && contains(other, child)))

      let childTime = 0
      let childRss = 0
      let childHeap = 0
      for (const child of directChildren) {
        childTime += child.duration
        childRss += child.memoryDelta.rss
        childHeap += child.memoryDelta.heapUsed
      }
      return {
        ownDuration: round(Math.max(0, phase.duration - childTime)),
        ownMemoryDelta: {
          rss: phase.memoryDelta.rss - childRss,
          heapUsed: phase.memoryDelta.heapUsed - childHeap,
        },
      }
    }

    const hookTotal = (hooks: Record<string, PluginHookTiming>) => Object.values(hooks).reduce((s, h) => s + h.totalTime, 0)

    return {
      totalDuration,
      totalMemoryDelta: getDelta(this.#globalMemoryBefore, getMemorySnapshot()),
      hasGCSnapshots: hasGC,
      phases: allPhases.map(p => ({
        name: p.name,
        duration: p.duration,
        ...computeOwn(p),
        memoryBefore: p.memoryBefore,
        memoryAfter: p.memoryAfter,
        memoryDelta: p.memoryDelta,
        retainedHeap: p.retainedMemory?.heapUsed,
      })),
      modules: this.#modules.toSorted((a, b) => b.setupTime - a.setupTime),
      bundlerPlugins: [...this.#bundlerPluginTimings.entries()]
        .map(([name, hookMap]) => {
          const hooks: Record<string, PluginHookTiming> = {}
          for (const [hookName, t] of hookMap) {
            hooks[hookName] = {
              totalTime: round(t.totalTime),
              count: t.count,
              maxTime: round(t.maxTime),
              avgTime: round(t.totalTime / t.count),
            }
          }
          return { name, hooks }
        })
        .sort((a, b) => hookTotal(b.hooks) - hookTotal(a.hooks)),
      timestamp: new Date().toISOString(),
    }
  }

  printReport (options?: { title?: string }): void {
    const report = this.getReport()

    const isSubPhase = (name: string) => name.startsWith('module:') || name.startsWith('vite:')
    const topPhases = report.phases.filter(p => !isSubPhase(p.name))
    const subPhases = report.phases.filter(p => isSubPhase(p.name))

    consola.log('')
    consola.log(colors.bold(colors.cyan(` ${options?.title || 'Nuxt Performance Report'}`)))
    consola.log('')

    const showRetained = report.hasGCSnapshots
    const columns = [24, 10, 14, 14, ...showRetained ? [16] : []]
    const row = (cells: string[]) => cells.map((cell, i) => pad(cell, columns[i]!, i ? 'right' : 'left')).join('  ')

    consola.log(`  ${row(['Phase', 'Duration', 'RSS Delta', 'Heap Delta', 'Retained Heap'].slice(0, columns.length).map(h => colors.bold(h)))}`)
    const separator = '  ' + colors.dim('─'.repeat(columns.reduce((sum, width) => sum + width + 2, -2)))
    consola.log(separator)

    const maxDuration = Math.max(...topPhases.map(p => p.ownDuration), 1)
    const maxRss = Math.max(...topPhases.map(p => Math.abs(p.ownMemoryDelta.rss)), 1)
    const barMax = 20

    for (const phase of topPhases) {
      const dur = phase.ownDuration
      const rss = phase.ownMemoryDelta.rss

      // log scale so small phases are still visible next to dominant ones
      const durBar = dur > 0 ? Math.max(1, Math.round((Math.log(dur + 1) / Math.log(maxDuration + 1)) * (barMax / 2))) : 0
      const memBar = Math.round((Math.abs(rss) / maxRss) * (barMax / 2))

      const durColor = thresholdColor(dur, 1000, 200, colors.green)
      const memColor = thresholdColor(Math.abs(rss), 50 * 1024 * 1024, 10 * 1024 * 1024, colors.green)

      const cells = [
        phase.name,
        durColor(formatDuration(dur)),
        memColor(formatSignedBytes(rss)),
        formatSignedBytes(phase.ownMemoryDelta.heapUsed),
      ]
      if (showRetained) {
        cells.push(phase.retainedHeap != null
          ? thresholdColor(phase.retainedHeap, 200 * 1024 * 1024, 100 * 1024 * 1024, colors.green)(formatBytes(phase.retainedHeap))
          : colors.dim('-'))
      }
      consola.log(`  ${row(cells)}  ${durColor('█'.repeat(durBar)) + memColor('░'.repeat(memBar))}`)
    }

    consola.log(separator)
    consola.log(`  ${row([
      'Total',
      formatDuration(report.totalDuration),
      formatSignedBytes(report.totalMemoryDelta.rss),
      formatSignedBytes(report.totalMemoryDelta.heapUsed),
    ].map(c => colors.bold(c)))}`)
    if (!showRetained) {
      consola.log(colors.dim('  Tip: run with NODE_OPTIONS=--expose-gc to see retained heap per phase'))
    }
    consola.log('')

    const printList = (title: string, items: string[]) => {
      if (!items.length) { return }
      consola.log(colors.bold(` ${title}`))
      consola.log('')
      for (const item of items) {
        consola.log(`  ${colors.dim('•')} ${item}`)
      }
      consola.log('')
    }

    printList('Modules', report.modules
      .filter(m => m.setupTime > 5)
      .map(m => `${m.name} ${colors.dim('-')} ${thresholdColor(m.setupTime, 500, 100)(formatDuration(m.setupTime))}`))

    printList('Bundler Plugins', report.bundlerPlugins
      .flatMap(plugin => Object.entries(plugin.hooks).map(([hook, timing]) => ({ plugin: plugin.name, hook, timing })))
      .filter(({ timing }) => timing.avgTime > 0.5)
      .sort((a, b) => b.timing.avgTime - a.timing.avgTime)
      .slice(0, 15)
      .map(({ plugin, hook, timing }) => {
        const maxLabel = timing.maxTime > timing.avgTime * 2 ? `, max ${formatDuration(timing.maxTime)}` : ''
        return `${plugin} ${colors.dim(hook)} ${colors.dim('-')} ${thresholdColor(timing.avgTime, 10, 2)(formatDuration(timing.avgTime) + '/file')}${colors.dim(maxLabel)} ${colors.dim(`(${timing.count} calls)`)}`
      }))

    printList('Details', subPhases
      .filter(p => p.duration > 5)
      .map(p => `${p.name} ${colors.dim('-')} ${thresholdColor(p.duration, 500, 100)(formatDuration(p.duration))}`))
  }

  /**
   * Generate trace events in Chrome Trace Event format.
   * The output can be loaded in chrome://tracing or https://ui.perfetto.dev
   */
  getTraceEvents (): TraceEvent[] {
    const pid = 1
    const tidPhases = 1
    const tidHooks = 2

    const toUs = (ms: number) => Math.round(ms * 1000 + this.#baseTs)
    const threadName = (tid: number, name: string): TraceEvent => ({ name: 'thread_name', ph: 'M', ts: 0, pid, tid, cat: '', args: { name } })
    const span = (name: string, cat: string, tid: number, start: number, end: number, args?: { begin?: Record<string, unknown>, end?: Record<string, unknown> }): TraceEvent[] => [
      { name, cat, ph: 'B', ts: toUs(start), pid, tid, ...args?.begin && { args: args.begin } },
      { name, cat, ph: 'E', ts: toUs(end), pid, tid, ...args?.end && { args: args.end } },
    ]

    const events: TraceEvent[] = [
      { name: 'process_name', ph: 'M', ts: 0, pid, tid: 0, cat: '', args: { name: 'Nuxt Build' } },
      threadName(tidPhases, 'Build'),
      threadName(tidHooks, 'Hooks'),
      ...span('nuxt build', 'build', tidPhases, this.#globalStart, performance.now()),
    ]

    for (const phase of this.#phases) {
      events.push(...span(phase.name, 'phase', tidPhases, phase.startTime, phase.endTime, {
        begin: { memoryBefore: { rss: phase.memoryBefore.rss, heapUsed: phase.memoryBefore.heapUsed } },
        end: { memoryDelta: phase.memoryDelta },
      }))
    }

    for (const hp of this.#hookPhases) {
      events.push(...span(hp.name, 'hook', tidHooks, hp.startTime, hp.endTime))
    }

    // Plugin spans can overlap (parallel transforms), so each group allocates lanes (threads)
    // to the spans in start order.
    const emitPluginSpans = (spans: PluginSpan[], label: string, baseTid: number) => {
      const laneEnds: number[] = []
      for (const span of spans.toSorted((a, b) => a.startTime - b.startTime)) {
        let lane = laneEnds.findIndex(end => end < span.startTime)
        if (lane === -1) {
          lane = laneEnds.push(0) - 1
        }
        laneEnds[lane] = span.startTime + span.durationMs
        events.push({
          name: `${span.pluginName}:${span.hookName}`,
          cat: label,
          ph: 'X',
          ts: toUs(span.startTime),
          dur: Math.round(span.durationMs * 1000),
          pid,
          tid: baseTid + lane,
        })
      }
      for (let i = 0; i < laneEnds.length; i++) {
        events.push(threadName(baseTid + i, laneEnds.length > 1 ? `${label} ${i + 1}` : label))
      }
    }

    emitPluginSpans(this.#bundlerPluginSpans.filter(s => !s.pluginName.startsWith('nitro:')), 'Vite Plugins', 10)
    emitPluginSpans(this.#bundlerPluginSpans.filter(s => s.pluginName.startsWith('nitro:')), 'Nitro Plugins', 110)

    const counter = (name: string, ts: number, args: Record<string, number>): TraceEvent => ({ name, cat: 'memory', ph: 'C', ts, pid, tid: 0, args })
    for (const phase of this.#phases) {
      events.push(
        counter('Memory', toUs(phase.startTime), { rss: phase.memoryBefore.rss, heapUsed: phase.memoryBefore.heapUsed }),
        counter('Memory', toUs(phase.endTime), { rss: phase.memoryAfter.rss, heapUsed: phase.memoryAfter.heapUsed }),
      )
      if (phase.retainedMemory) {
        // a separate series, emitted just after the phase end to keep the ordering
        events.push(counter('Retained Memory', toUs(phase.endTime) + 1, { heapRetained: phase.retainedMemory.heapUsed, rssRetained: phase.retainedMemory.rss }))
      }
    }

    return events
  }

  writeReport (buildDir: string, options?: { quiet?: boolean }): string {
    const toLink = (path: string) => link(path, { formatter: absolute => relative(process.cwd(), absolute).replace(/^(?![^.]{1,2}\/)/, './') })
    const reportPath = join(buildDir, 'perf-report.json')
    const tracePath = join(buildDir, 'perf-trace.json')
    try {
      mkdirSync(buildDir, { recursive: true })
      writeFileSync(reportPath, JSON.stringify(this.getReport(), null, 2), 'utf-8')
      writeFileSync(tracePath, JSON.stringify({ traceEvents: this.getTraceEvents() }), 'utf-8')
      if (!options?.quiet) {
        consola.log(colors.dim(` Data dump written to ${toLink(reportPath)}`))
        consola.log(colors.dim(` Trace written to ${toLink(tracePath)} (load in \`https://ui.perfetto.dev\`)`))
        consola.log('')
      }
    } catch {
      // the report is best-effort
    }
    return reportPath
  }

  dispose (): void {
    this.#unsubscribe?.()
  }
}
