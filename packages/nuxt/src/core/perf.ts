import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'pathe'
import { consola } from 'consola'
import { link } from 'clickable-path'
import { colors } from 'consola/utils'
import type { NuxtHookRegistry } from '@nuxt/schema'
import type { Nuxt, NuxtHooks } from 'nuxt/schema'
import { HookCpuTracker } from './perf-cpu.ts'
import type { CpuOwner } from './perf-cpu.ts'

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
  /** The phase had not ended when the report was taken, for example because the build failed. */
  unfinished?: boolean
  /** The phase ran before the profiler was created, so its memory was not measured. */
  memoryUnmeasured?: boolean
}

interface OpenPhase {
  name: string
  startTime: number
  memoryBefore: MemorySnapshot
}

/** A stretch of time in which at least one hook call had yielded and not yet settled. */
interface WaitingWindow {
  startTime: number
  endTime: number
  /** How long the event loop was idle in the window. */
  idle: number
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
  /**
   * Part of `totalTime` in which the main thread was idle or running other hooks' calls before
   * they first yielded: a lower bound on the time the hook spent waiting rather than working.
   * With `bundlerPluginWaiting: 'cpu'`, `totalTime` minus `cpuTime`.
   */
  waitingTime: number
  /** Time the main thread spent running the hook's own code, with `bundlerPluginWaiting: 'cpu'`. */
  cpuTime?: number
}

interface HookTiming {
  totalTime: number
  waitingTime: number
  count: number
  maxTime: number
  running: number
  runningSince: number
  waitingSince: number
  /** Time spent in calls of this hook before they first yielded to the event loop. */
  turnTime: number
  /** Timings from start to settle, against the time the hook's own code ran. */
  cpu?: { time: number, totalTime: number, maxTime: number, running: number, runningSince: number }
}

/** The task a hook call started in, until it first yields to the event loop. */
interface Turn {
  timing: HookTiming
  startTime: number
  endTime?: number
  /** Another hook call ran in the same task, so the time cannot be told apart. */
  shared: boolean
}

interface PluginSpan {
  pluginName: string
  hookName: string
  startTime: number
  endTime: number
  durationMs: number
  waitingMs: number
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
    unfinished?: boolean
    memoryUnmeasured?: boolean
    /** Share of the time the main thread was busy while bundler plugin hooks were waiting. */
    eventLoopUtilization?: number
  }>
  /** Time inside `totalDuration` that no phase covers. */
  unattributedDuration: number
  modules: ModuleTiming[]
  bundlerPlugins: Array<{ name: string, hooks: Record<string, PluginHookTiming> }>
  /**
   * How `waitingTime` was measured: `lower-bound` from time other work was known to run, or `cpu`
   * from each call's time between start and settle minus the time its own code ran.
   */
  bundlerPluginWaiting: 'lower-bound' | 'cpu'
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

/** Hooks waiting for at least this share of their time are marked as waiting. */
const WAITING_SHARE = 0.5

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

/** A Proxy `get` trap must return these properties unchanged. */
function isReadonlyProperty (target: object, key: PropertyKey) {
  const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
  return !!descriptor && !descriptor.configurable && !descriptor.writable
}

function startRunning (timing: HookTiming, now: number, othersTime: number) {
  if (timing.running++ === 0) {
    timing.runningSince = now
    timing.waitingSince = othersTime
  }
}

function stopRunning (timing: HookTiming, now: number, othersTime: number) {
  if (--timing.running === 0) {
    timing.totalTime += now - timing.runningSince
    timing.waitingTime += othersTime - timing.waitingSince
  }
}

function contains (outer: { startTime: number, endTime: number }, inner: { startTime: number, endTime: number }) {
  return inner.startTime >= outer.startTime && inner.endTime <= outer.endTime
}

/** Total time covered by at least one of `phases`. */
function coveredDuration (phases: PerfPhase[]): number {
  let covered = 0
  let end = -Infinity
  for (const phase of phases.toSorted((a, b) => a.startTime - b.startTime)) {
    if (phase.endTime <= end) { continue }
    covered += phase.endTime - Math.max(phase.startTime, end)
    end = phase.endTime
  }
  return covered
}

/** The innermost phase running throughout `start` to `end`: the latest to start, then the first to end. */
function innermostPhase (phases: PerfPhase[], start: number, end: number): PerfPhase | undefined {
  let innermost: PerfPhase | undefined
  for (const phase of phases) {
    if (phase.startTime > start || phase.endTime < end) { continue }
    if (!innermost || phase.startTime > innermost.startTime || (phase.startTime === innermost.startTime && phase.endTime <= innermost.endTime)) {
      innermost = phase
    }
  }
  return innermost
}

/** How long each phase was the innermost one running. */
function exclusiveDurations (phases: PerfPhase[]): Map<PerfPhase, number> {
  const durations = new Map(phases.map(phase => [phase, 0]))
  const times = [...new Set(phases.flatMap(phase => [phase.startTime, phase.endTime]))].sort((a, b) => a - b)
  for (let i = 0; i < times.length - 1; i++) {
    const start = times[i]!
    const end = times[i + 1]!
    const innermost = innermostPhase(phases, start, end)
    if (innermost) {
      durations.set(innermost, durations.get(innermost)! + end - start)
    }
  }
  return durations
}

function eventLoopUtilization (windows: WaitingWindow[]): number | undefined {
  let duration = 0
  let idle = 0
  for (const window of windows) {
    duration += window.endTime - window.startTime
    idle += window.idle
  }
  return duration > 0 ? round(Math.min(1, Math.max(0, 1 - idle / duration))) : undefined
}

/** Sub-phases are listed under Details, and their time stays in the row of the phase they run in. */
const isSubPhase = (name: string) => name.startsWith('module:')

let claimedCliStartTime: number | undefined

/** When the CLI started, or `undefined` if a profiler in this process has already measured from it. */
export function claimCliStartTime (): number | undefined {
  const startTime = (globalThis as any).__nuxt_cli__?.startTime as number | undefined
  if (!startTime || startTime === claimedCliStartTime) { return }
  claimedCliStartTime = startTime
  return startTime
}

/** Hooks taking at least this long are shown alongside the phases. */
const HOOK_PHASE_THRESHOLD_MS = 5

export class NuxtPerfProfiler {
  #phases: PerfPhase[] = []
  #phaseStack: OpenPhase[] = []
  #hookPhases: PerfPhase[] = []
  #hookStartStack: OpenPhase[] = []
  #modules: ModuleTiming[] = []
  #bundlerPluginTimings = new Map<string, Map<string, HookTiming>>()
  #bundlerPluginSpans: PluginSpan[] = []
  #turn?: Turn
  #turnTime = 0
  // `async_hooks` is discouraged by Node and slows every `await` while enabled; work from resources
  // created outside a hook call (shared emitters, bundler glue) or on other threads is not
  // attributed, and times are wall-clock slices of the main thread. `NUXT_DEBUG_PERF_CPU=0` is an
  // internal, unsupported opt-out to the lower bound.
  #cpu = process.env.NUXT_DEBUG_PERF_CPU === '0' ? undefined : new HookCpuTracker()
  #waitingCalls = 0
  #waitingWindow?: { startTime: number, idleBefore: number }
  #waitingWindows: WaitingWindow[] = []
  #globalStart: number
  #globalMemoryBefore: MemorySnapshot
  #unsubscribe?: () => void
  /** Offset to convert performance.now() (ms) to epoch microseconds for trace events */
  #baseTs: number

  constructor (options?: {
    /** When the CLI started, from `Date.now()`. Reported as a `startup` phase. */
    startTime?: number
    /**
     * When `startup` ended, from `performance.now()`. Without `startTime`, the report starts here.
     * Defaults to the time the profiler is created.
     */
    startupEndTime?: number
  }) {
    this.#globalStart = options?.startTime ? performance.now() - (Date.now() - options.startTime) : options?.startupEndTime ?? performance.now()
    this.#globalMemoryBefore = getMemorySnapshot()
    this.#baseTs = Date.now() * 1000 - performance.now() * 1000
    if (options?.startTime) {
      this.recordPhase('startup', this.#globalStart, options.startupEndTime)
    }
  }

  /** Record a phase that ran before the profiler was created. Its memory is not measured. */
  recordPhase (name: string, startTime: number, endTime = performance.now()): void {
    this.#phases.push({
      name,
      startTime,
      endTime,
      duration: round(endTime - startTime),
      memoryBefore: this.#globalMemoryBefore,
      memoryAfter: this.#globalMemoryBefore,
      memoryDelta: { rss: 0, heapUsed: 0 },
      memoryUnmeasured: true,
    })
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
      this.#hookStartStack.push(this.#open(event.name))
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
    this.#phaseStack.push(this.#open(name))
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

  #open (name: string): OpenPhase {
    const startTime = performance.now()
    this.#splitWaitingWindow(startTime)
    return { name, startTime, memoryBefore: getMemorySnapshot() }
  }

  #close (open: OpenPhase): PerfPhase {
    const endTime = performance.now()
    this.#splitWaitingWindow(endTime)
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

  #startWaiting () {
    if (this.#waitingCalls++ === 0) {
      this.#waitingWindow = { startTime: performance.now(), idleBefore: performance.eventLoopUtilization().idle }
    }
  }

  #stopWaiting (now: number) {
    if (--this.#waitingCalls === 0) {
      this.#splitWaitingWindow(now)
      this.#waitingWindow = undefined
    }
  }

  /** Ends the current waiting window at `now` and starts the next, so no window spans a phase boundary. */
  #splitWaitingWindow (now: number) {
    const window = this.#waitingWindow
    if (!window) { return }
    const idle = performance.eventLoopUtilization().idle
    this.#waitingWindows.push({ startTime: window.startTime, endTime: now, idle: idle - window.idleBefore })
    this.#waitingWindow = { startTime: now, idleBefore: idle }
  }

  #getWaitingWindows (now: number): WaitingWindow[] {
    const window = this.#waitingWindow
    return window
      ? [...this.#waitingWindows, { startTime: window.startTime, endTime: now, idle: performance.eventLoopUtilization().idle - window.idleBefore }]
      : this.#waitingWindows
  }

  /** Time the main thread has spent idle or in the turns of other hooks' calls. */
  #othersTime (timing: HookTiming): number {
    return performance.eventLoopUtilization().idle + this.#turnTime - timing.turnTime
  }

  #closeTurn (turn: Turn) {
    if (this.#turn !== turn) { return }
    this.#turn = undefined
    if (!turn.shared) {
      const duration = (turn.endTime ?? performance.now()) - turn.startTime
      turn.timing.turnTime += duration
      this.#turnTime += duration
    }
  }

  #hookTiming (pluginName: string, hookName: string): HookTiming {
    let plugin = this.#bundlerPluginTimings.get(pluginName)
    if (!plugin) {
      plugin = new Map()
      this.#bundlerPluginTimings.set(pluginName, plugin)
    }
    let timing = plugin.get(hookName)
    if (!timing) {
      timing = { totalTime: 0, waitingTime: 0, count: 0, maxTime: 0, running: 0, runningSince: 0, waitingSince: 0, turnTime: 0 }
      plugin.set(hookName, timing)
    }
    return timing
  }

  #recordSpan (pluginName: string, hookName: string, durationMs: number, startTime: number, endTime: number, waitingMs = 0) {
    if (endTime - startTime > 0.1) {
      this.#bundlerPluginSpans.push({ pluginName, hookName, startTime, endTime, durationMs, waitingMs })
    }
  }

  recordBundlerPluginHook (pluginName: string, hookName: string, durationMs: number, startTime?: number): void {
    const timing = this.#hookTiming(pluginName, hookName)
    timing.totalTime += durationMs
    timing.count++
    timing.maxTime = Math.max(timing.maxTime, durationMs)
    if (startTime != null) {
      this.#recordSpan(pluginName, hookName, durationMs, startTime, startTime + durationMs)
    }
  }

  /**
   * Runs a bundler plugin hook with a proxy of `ctx` as its plugin context and records how long it took.
   *
   * Time spent awaiting `this.resolve()` or `this.load()` is left out, as those calls run other
   * plugins' hooks, which are recorded separately. Calls of the same hook that overlap are
   * counted once, so its total time never exceeds the wall-clock time it was running.
   *
   * While the hook is running, time in which the main thread was idle or running other hooks'
   * calls before they first yielded is recorded as time it was waiting.
   */
  timeBundlerHook<T> (pluginName: string, hookName: string, ctx: unknown, run: (ctx: any) => T): T {
    const timing = this.#hookTiming(pluginName, hookName)
    let owner: CpuOwner | undefined
    if (this.#cpu?.enable()) {
      owner = this.#cpu.createOwner()
      timing.cpu ??= { time: 0, totalTime: 0, maxTime: 0, running: 0, runningSince: 0 }
    }
    const start = performance.now()
    if (owner && timing.cpu!.running++ === 0) { timing.cpu!.runningSince = start }
    let othersSince = this.#othersTime(timing)
    let waiting = 0
    timing.count++
    startRunning(timing, start, othersSince)
    let turn: Turn | undefined
    if (this.#turn) {
      this.#turn.shared = true
    } else {
      turn = this.#turn = { timing, startTime: start, shared: false }
    }
    const stop = (now: number) => {
      const othersTime = this.#othersTime(timing)
      waiting += othersTime - othersSince
      stopRunning(timing, now, othersTime)
    }
    let done = false
    // parallel calls overlap, so subtract how long at least one of them was pending
    let pending = 0
    let pendingSince = 0
    let nested = 0
    // other plugins' hooks cannot run until the hook first yields
    let sync = true
    const pause = () => {
      pendingSince = performance.now()
      if (!done) { stop(pendingSince) }
    }
    const leaveSync = () => {
      sync = false
      if (pending > 0) { pause() }
    }
    const exit = () => {
      if (--pending > 0 || sync) { return }
      const now = performance.now()
      nested += now - pendingSince
      if (!done) {
        othersSince = this.#othersTime(timing)
        startRunning(timing, now, othersSince)
      }
    }
    const proxy = ctx && typeof ctx === 'object'
      ? new Proxy(ctx, {
          get (target, key) {
            const value = Reflect.get(target, key, target)
            if (typeof value !== 'function' || isReadonlyProperty(target, key)) { return value }
            // bound so that methods relying on private fields or native receivers still work
            if (key !== 'resolve' && key !== 'load') { return value.bind(target) }
            return (...args: unknown[]) => {
              if (pending++ === 0 && !sync) { pause() }
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
      const duration = end - start - nested - (pending > 0 ? end - pendingSince : 0)
      done = true
      if (pending === 0) { stop(end) }
      if (turn) { turn.endTime ??= end }
      timing.maxTime = Math.max(timing.maxTime, duration)
      if (owner) {
        owner.done = true
        const cpu = timing.cpu!
        cpu.time += owner.cpuTime
        cpu.maxTime = Math.max(cpu.maxTime, end - start)
        if (--cpu.running === 0) { cpu.totalTime += end - cpu.runningSince }
        this.#recordSpan(pluginName, hookName, end - start, start, end, Math.max(0, end - start - owner.cpuTime))
      } else {
        this.#recordSpan(pluginName, hookName, duration, start, end, waiting)
      }
      return end
    }
    try {
      const result = owner ? this.#cpu!.run(owner, () => run(proxy)) : run(proxy)
      leaveSync()
      if (result && typeof result === 'object' && 'then' in result) {
        let yielded = false
        const leaveTurn = () => {
          if (turn) { this.#closeTurn(turn) }
          if (!done) {
            yielded = true
            this.#startWaiting()
          }
        }
        // a tick queued from a microtask runs once the microtask queue is empty, when the hook has yielded
        queueMicrotask(() => process.nextTick(leaveTurn))
        return (result as unknown as Promise<unknown>).finally(() => {
          const end = record()
          if (yielded) { this.#stopWaiting(end) }
        }) as T
      }
      record()
      if (turn) { this.#closeTurn(turn) }
      return result
    } catch (err) {
      leaveSync()
      record()
      if (turn) { this.#closeTurn(turn) }
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
    const now = performance.now()
    const totalDuration = round(now - this.#globalStart)
    const manualPhases = this.#getPhases(now)

    // hook invocations above the threshold are shown as phases unless a manual phase of the same
    // name already covers them
    const allPhases: PerfPhase[] = [
      ...manualPhases,
      ...this.#hookPhases.filter(hp => hp.duration >= HOOK_PHASE_THRESHOLD_MS && !manualPhases.some(p => p.name === hp.name && contains(p, hp))),
    ].sort((a, b) => a.startTime - b.startTime)

    // sub-phases do not reduce the own time of top-level phases
    const topPhases = allPhases.filter(p => !isSubPhase(p.name))
    const ownTimes = exclusiveDurations(topPhases)
    const subPhaseOwnTimes = exclusiveDurations(allPhases)
    const ownWaitingWindows = new Map<PerfPhase, WaitingWindow[]>()
    for (const window of this.#getWaitingWindows(now)) {
      const phase = innermostPhase(topPhases, window.startTime, window.endTime)
      const windows = phase && ownWaitingWindows.get(phase)
      if (windows) {
        windows.push(window)
      } else if (phase) {
        ownWaitingWindows.set(phase, [window])
      }
    }

    // own memory excludes direct children (phases nested in this one but in no other child)
    function computeOwn (phase: PerfPhase) {
      const children = allPhases.filter(other => other !== phase && !isSubPhase(other.name) && contains(phase, other))
      const directChildren = children.filter(child => !children.some(other => other !== child && contains(other, child)))

      let childRss = 0
      let childHeap = 0
      for (const child of directChildren) {
        childRss += child.memoryDelta.rss
        childHeap += child.memoryDelta.heapUsed
      }
      return {
        ownDuration: round((isSubPhase(phase.name) ? subPhaseOwnTimes : ownTimes).get(phase)!),
        ownMemoryDelta: {
          rss: phase.memoryDelta.rss - childRss,
          heapUsed: phase.memoryDelta.heapUsed - childHeap,
        },
      }
    }

    const hookTotal = (hooks: Record<string, PluginHookTiming>) => Object.values(hooks).reduce((s, h) => s + h.totalTime - h.waitingTime, 0)

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
        unfinished: p.unfinished,
        memoryUnmeasured: p.memoryUnmeasured,
        eventLoopUtilization: eventLoopUtilization(ownWaitingWindows.get(p) ?? []),
      })),
      unattributedDuration: round(Math.max(0, totalDuration - coveredDuration(topPhases))),
      modules: this.#modules.toSorted((a, b) => b.setupTime - a.setupTime),
      bundlerPlugins: [...this.#bundlerPluginTimings.entries()]
        .map(([name, hookMap]) => {
          const hooks: Record<string, PluginHookTiming> = {}
          for (const [hookName, t] of hookMap) {
            hooks[hookName] = t.cpu
              ? {
                  totalTime: round(t.cpu.totalTime),
                  count: t.count,
                  maxTime: round(t.cpu.maxTime),
                  avgTime: round(t.cpu.totalTime / t.count),
                  waitingTime: round(Math.max(0, t.cpu.totalTime - t.cpu.time)),
                  cpuTime: round(Math.min(t.cpu.time, t.cpu.totalTime)),
                }
              : {
                  totalTime: round(t.totalTime),
                  count: t.count,
                  maxTime: round(t.maxTime),
                  avgTime: round(t.totalTime / t.count),
                  waitingTime: round(Math.min(t.waitingTime, t.totalTime)),
                }
          }
          return { name, hooks }
        })
        .sort((a, b) => hookTotal(b.hooks) - hookTotal(a.hooks)),
      bundlerPluginWaiting: this.#cpu?.used ? 'cpu' : 'lower-bound',
      timestamp: new Date().toISOString(),
    }
  }

  printReport (options?: { title?: string }): void {
    const report = this.getReport()

    const topPhases = report.phases.filter(p => !isSubPhase(p.name))
    const subPhases = report.phases.filter(p => isSubPhase(p.name))

    consola.log('')
    consola.log(colors.bold(colors.cyan(` ${options?.title || 'Nuxt Performance Report'}`)))
    consola.log('')

    const showRetained = report.hasGCSnapshots
    const showBusy = topPhases.some(p => p.eventLoopUtilization != null)
    const headers = ['Phase', 'Duration', ...showBusy ? ['Main Thread'] : [], 'RSS Delta', 'Heap Delta', ...showRetained ? ['Retained Heap'] : []]
    const columns = [24, 10, ...showBusy ? [11] : [], 14, 14, ...showRetained ? [16] : []]
    const row = (cells: string[]) => cells.map((cell, i) => pad(cell, columns[i]!, i ? 'right' : 'left')).join('  ')

    consola.log(`  ${row(headers.map(h => colors.bold(h)))}`)
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

      const busy = phase.eventLoopUtilization
      const cells = [
        phase.name,
        durColor(formatDuration(dur)),
        ...showBusy ? [busy == null ? '' : thresholdColor(busy, 0.95, 0.8)(`${Math.round(busy * 100)}%`)] : [],
        phase.memoryUnmeasured ? colors.dim('-') : memColor(formatSignedBytes(rss)),
        phase.memoryUnmeasured ? colors.dim('-') : formatSignedBytes(phase.ownMemoryDelta.heapUsed),
      ]
      if (showRetained) {
        cells.push(phase.retainedHeap != null
          ? thresholdColor(phase.retainedHeap, 200 * 1024 * 1024, 100 * 1024 * 1024, colors.green)(formatBytes(phase.retainedHeap))
          : colors.dim('-'))
      }
      consola.log(`  ${row(cells)}  ${durColor('█'.repeat(durBar)) + memColor('░'.repeat(memBar))}${phase.unfinished ? ` ${colors.red('unfinished')}` : ''}`)
    }
    if (report.unattributedDuration >= 1) {
      consola.log(`  ${row([colors.dim('(no phase)'), colors.dim(formatDuration(report.unattributedDuration))])}`)
    }

    consola.log(separator)
    consola.log(`  ${row([
      'Total',
      formatDuration(report.totalDuration),
      ...showBusy ? [''] : [],
      formatSignedBytes(report.totalMemoryDelta.rss),
      formatSignedBytes(report.totalMemoryDelta.heapUsed),
    ].map(c => colors.bold(c)))}`)
    if (showBusy) {
      consola.log(colors.dim('  Main Thread: how busy the main thread was while bundler plugin hooks were waiting'))
    }
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

    const pluginHooks = report.bundlerPlugins
      .flatMap(plugin => Object.entries(plugin.hooks).map(([hook, timing]) => ({
        plugin: plugin.name,
        hook,
        timing,
        ownTime: timing.totalTime - timing.waitingTime,
        waiting: timing.waitingTime >= timing.totalTime * WAITING_SHARE,
      })))
      .filter(({ ownTime }) => ownTime > 5)
      .sort((a, b) => b.ownTime - a.ownTime)
      .slice(0, 15)
    printList('Bundler Plugins', pluginHooks.map(({ plugin, hook, timing, ownTime, waiting }) => {
      const own = formatDuration(ownTime)
      const total = formatDuration(timing.totalTime)
      const details = [
        timing.count > 1 ? `${timing.count} calls, ${formatDuration(timing.avgTime)}/file` : '1 call',
        ...timing.count > 1 && timing.maxTime > timing.avgTime * 2 ? [`max ${formatDuration(timing.maxTime)}`] : [],
        ...total !== own ? [`${total} total`] : [],
      ]
      const ownColor = waiting ? colors.dim : thresholdColor(ownTime, 1000, 200)
      return `${plugin} ${colors.dim(hook)} ${colors.dim('-')} ${ownColor(own)} ${colors.dim(`(${details.join(', ')})`)}${waiting ? ` ${colors.dim('- waiting')}` : ''}`
    }))
    if (pluginHooks.length) {
      const cpu = report.bundlerPluginWaiting === 'cpu'
      consola.log(colors.dim(cpu
        ? '  Hooks are listed by the time the main thread spent running their own code.'
        : '  Hooks are listed by total time, leaving out a lower bound of the time they were waiting.'))
      if (pluginHooks.some(h => h.waiting)) {
        consola.log(colors.dim(cpu
          ? '  waiting: for at least half its time the hook was not running its own code'
          : '  waiting: for at least half its time the main thread was idle or running other hooks; unmarked hooks may also have been waiting'))
      }
      consola.log('')
    }

    printList('Details', subPhases
      .filter(p => p.duration > 5)
      .map(p => `${p.name} ${colors.dim('-')} ${thresholdColor(p.duration, 500, 100)(formatDuration(p.duration))}${p.unfinished ? ` ${colors.red('unfinished')}` : ''}`))
  }

  /**
   * Generate trace events in Chrome Trace Event format.
   * The output can be loaded in chrome://tracing or https://ui.perfetto.dev
   */
  getTraceEvents (): TraceEvent[] {
    const pid = 1
    const tidPhases = 1
    const tidHooks = 2

    const globalEnd = performance.now()
    const phases = this.#getPhases(globalEnd)
    const waitingWindows = this.#getWaitingWindows(globalEnd)
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
      ...span('nuxt build', 'build', tidPhases, this.#globalStart, globalEnd),
    ]

    for (const phase of phases) {
      events.push(...span(phase.name, 'phase', tidPhases, phase.startTime, phase.endTime, phase.memoryUnmeasured
        ? undefined
        : {
            begin: { memoryBefore: { rss: phase.memoryBefore.rss, heapUsed: phase.memoryBefore.heapUsed } },
            end: {
              memoryDelta: phase.memoryDelta,
              eventLoopUtilization: eventLoopUtilization(waitingWindows.filter(window => contains(phase, window))),
            },
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
        laneEnds[lane] = span.endTime
        events.push({
          name: `${span.pluginName}:${span.hookName}`,
          cat: label,
          ph: 'X',
          ts: toUs(span.startTime),
          dur: Math.round((span.endTime - span.startTime) * 1000),
          pid,
          tid: baseTid + lane,
          args: { durationMs: round(span.durationMs), ...span.waitingMs > 0 && { waitingMs: round(Math.min(span.waitingMs, span.durationMs)) } },
        })
      }
      for (let i = 0; i < laneEnds.length; i++) {
        events.push(threadName(baseTid + i, laneEnds.length > 1 ? `${label} ${i + 1}` : label))
      }
    }

    emitPluginSpans(this.#bundlerPluginSpans.filter(s => !s.pluginName.startsWith('nitro:')), 'Vite Plugins', 10)
    emitPluginSpans(this.#bundlerPluginSpans.filter(s => s.pluginName.startsWith('nitro:')), 'Nitro Plugins', 110)

    const counter = (name: string, ts: number, args: Record<string, number>): TraceEvent => ({ name, cat: 'memory', ph: 'C', ts, pid, tid: 0, args })
    for (const phase of phases) {
      if (phase.memoryUnmeasured) { continue }
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

  #getPhases (now: number): PerfPhase[] {
    const memoryNow = getMemorySnapshot()
    const unfinished = this.#phaseStack.map(open => ({
      name: open.name,
      startTime: open.startTime,
      endTime: now,
      duration: round(now - open.startTime),
      memoryBefore: open.memoryBefore,
      memoryAfter: memoryNow,
      memoryDelta: getDelta(open.memoryBefore, memoryNow),
      unfinished: true,
    }))
    return [...this.#phases, ...unfinished]
  }

  dispose (): void {
    this.#cpu?.disable()
    this.#unsubscribe?.()
  }
}
