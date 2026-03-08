import { performance } from 'node:perf_hooks'
import process from 'node:process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'pathe'
import { consola } from 'consola'
import { colors } from 'consola/utils'
import type { Hookable } from 'hookable'
import type { NuxtHooks } from 'nuxt/schema'

export interface MemorySnapshot {
  rss: number
  heapUsed: number
  heapTotal: number
}

interface PerfPhase {
  name: string
  startTime: number
  endTime: number
  duration: number
  memoryBefore: MemorySnapshot
  memoryAfter: MemorySnapshot
  memoryDelta: { rss: number, heapUsed: number }
}

interface OpenPhase {
  name: string
  startTime: number
  memoryBefore: MemorySnapshot
}

export interface SlowHook {
  name: string
  duration: number
  ownDuration: number
  phase: string
}

export interface ModuleTiming {
  name: string
  setupTime: number
}

export interface PluginHookTiming {
  totalTime: number
  count: number
  maxTime: number
  avgTime: number
}

export interface BundlerPluginTiming {
  name: string
  hooks: Record<string, PluginHookTiming>
}

export interface PerfReport {
  totalDuration: number
  totalMemoryDelta: { rss: number, heapUsed: number }
  phases: Array<{
    name: string
    duration: number
    ownDuration: number
    memoryBefore: MemorySnapshot
    memoryAfter: MemorySnapshot
    memoryDelta: { rss: number, heapUsed: number }
    ownMemoryDelta: { rss: number, heapUsed: number }
  }>
  slowHooks: SlowHook[]
  modules: ModuleTiming[]
  bundlerPlugins: BundlerPluginTiming[]
  timestamp: string
}

function getMemorySnapshot (): MemorySnapshot {
  const mem = process.memoryUsage()
  return { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal }
}

function formatBytes (bytes: number): string {
  const abs = Math.abs(bytes)
  if (abs < 1024) { return `${bytes} B` }
  if (abs < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} KB` }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration (ms: number): string {
  if (ms < 1) { return `${Math.round(ms * 1000)}µs` }
  if (ms < 1000) { return `${Math.round(ms)}ms` }
  if (ms < 60_000) { return `${(ms / 1000).toFixed(1)}s` }
  return `${(ms / 60_000).toFixed(1)}min`
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B\[[0-9;]*m/g

function pad (str: string, width: number, align: 'left' | 'right' = 'left'): string {
  const stripped = str.replace(ANSI_RE, '')
  const diff = width - stripped.length
  if (diff <= 0) { return str }
  const padding = ' '.repeat(diff)
  return align === 'right' ? padding + str : str + padding
}

function round (n: number): number {
  return Math.round(n * 100) / 100
}

const SLOW_HOOK_THRESHOLD_MS = Number(process.env.NUXT_PERF_SLOW_HOOK_MS) || 50

const HOOK_PHASE_THRESHOLD_MS = 5

export class NuxtPerfProfiler {
  #phases: PerfPhase[] = []
  #phaseStack: OpenPhase[] = []
  #hookPhases: PerfPhase[] = []
  #hookStarts = new Map<string, { time: number, memory: MemorySnapshot }>()
  #hookStack: string[] = []
  #modules: ModuleTiming[] = []
  #bundlerPluginTimings = new Map<string, Map<string, { totalTime: number, count: number, maxTime: number }>>()
  #globalStart: number
  #globalMemoryBefore: MemorySnapshot
  #unsubscribe?: () => void
  #cpuProfileSession?: import('node:inspector').Session
  #cpuProfileCount = 0

  constructor () {
    this.#globalStart = performance.now()
    this.#globalMemoryBefore = getMemorySnapshot()
  }

  async startCpuProfile (): Promise<void> {
    const inspector = await import('node:inspector')
    const session = new inspector.Session()
    session.connect()
    await new Promise<void>((res, rej) => {
      session.post('Profiler.enable', () => {
        session.post('Profiler.start', (err) => {
          if (err) { rej(err) } else { res() }
        })
      })
    })
    this.#cpuProfileSession = session
    consola.info('CPU profiler started')
  }

  stopCpuProfile (cwd?: string): Promise<string | undefined> {
    const session = this.#cpuProfileSession
    if (!session) { return Promise.resolve(undefined) }
    this.#cpuProfileSession = undefined
    return new Promise((res, rej) => {
      session.post('Profiler.stop', (err, { profile }) => {
        if (err) { return rej(err) }
        const outPath = resolve(cwd || '.', `nuxt-profile-${this.#cpuProfileCount++}.cpuprofile`)
        writeFile(outPath, JSON.stringify(profile)).then(() => {
          consola.info(`CPU profile written to ${colors.cyan(outPath)}`)
          consola.info(`Open it in ${colors.cyan('https://www.speedscope.app')} or Chrome DevTools`)
          session.disconnect()
          res(outPath)
        }).catch(rej)
      })
    })
  }

  get isCpuProfileActive (): boolean {
    return !!this.#cpuProfileSession
  }

  installHookInterceptors (hooks: Hookable<NuxtHooks>): void {
    const unsubBefore = hooks.beforeEach((event) => {
      this.#hookStarts.set(event.name, {
        time: performance.now(),
        memory: getMemorySnapshot(),
      })
      this.#hookStack.push(event.name)
    })

    const unsubAfter = hooks.afterEach((event) => {
      const start = this.#hookStarts.get(event.name)
      if (!start) { return }
      this.#hookStarts.delete(event.name)
      this.#hookStack.pop()

      const endTime = performance.now()
      const memoryAfter = getMemorySnapshot()
      const duration = round(endTime - start.time)

      this.#hookPhases.push({
        name: `hook:${event.name}`,
        startTime: start.time,
        endTime,
        duration,
        memoryBefore: start.memory,
        memoryAfter,
        memoryDelta: {
          rss: memoryAfter.rss - start.memory.rss,
          heapUsed: memoryAfter.heapUsed - start.memory.heapUsed,
        },
      })
    })

    this.#unsubscribe = () => {
      unsubBefore()
      unsubAfter()
    }
  }

  startPhase (name: string): void {
    this.#phaseStack.push({
      name,
      startTime: performance.now(),
      memoryBefore: getMemorySnapshot(),
    })
  }

  endPhase (name?: string): void {
    let phaseIdx = this.#phaseStack.length - 1
    if (name) {
      phaseIdx = -1
      for (let i = this.#phaseStack.length - 1; i >= 0; i--) {
        if (this.#phaseStack[i]!.name === name) {
          phaseIdx = i
          break
        }
      }
      if (phaseIdx === -1) { return }
    }
    if (phaseIdx < 0) { return }

    const open = this.#phaseStack.splice(phaseIdx, 1)[0]!
    const endTime = performance.now()
    const memoryAfter = getMemorySnapshot()

    this.#phases.push({
      name: open.name,
      startTime: open.startTime,
      endTime,
      duration: round(endTime - open.startTime),
      memoryBefore: open.memoryBefore,
      memoryAfter,
      memoryDelta: {
        rss: memoryAfter.rss - open.memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - open.memoryBefore.heapUsed,
      },
    })
  }

  recordBundlerPluginHook (pluginName: string, hookName: string, durationMs: number): void {
    let plugin = this.#bundlerPluginTimings.get(pluginName)
    if (!plugin) {
      plugin = new Map()
      this.#bundlerPluginTimings.set(pluginName, plugin)
    }
    const entry = plugin.get(hookName)
    if (entry) {
      entry.totalTime += durationMs
      entry.count++
      if (durationMs > entry.maxTime) { entry.maxTime = durationMs }
    } else {
      plugin.set(hookName, { totalTime: durationMs, count: 1, maxTime: durationMs })
    }
  }

  collectModuleTimings (installedModules: Array<{ meta?: { name?: string }, timings?: Record<string, number | undefined> }>): void {
    for (const mod of installedModules) {
      const name = mod.meta?.name || '(anonymous)'
      const setupTime = mod.timings?.setup
      if (setupTime != null) {
        this.#modules.push({ name, setupTime })
      }
    }
  }

  getReport (): PerfReport {
    const totalDuration = round(performance.now() - this.#globalStart)
    const globalMemoryAfter = getMemorySnapshot()

    // Merge manual phases with hook phases that exceeded the threshold
    // and aren't already covered by a manual phase.
    const allPhases: PerfPhase[] = [...this.#phases]
    for (const hp of this.#hookPhases) {
      if (hp.duration < HOOK_PHASE_THRESHOLD_MS) { continue }
      const hookName = hp.name.slice(5) // strip "hook:" prefix
      const alreadyCovered = this.#phases.some(p =>
        p.name === hookName && p.startTime <= hp.startTime && p.endTime >= hp.endTime,
      )
      if (!alreadyCovered) {
        allPhases.push({ ...hp, name: hookName })
      }
    }

    // Sort by start time for correct display order
    allPhases.sort((a, b) => a.startTime - b.startTime)

    // Compute own-time and own-memory for each phase by subtracting
    // child phases nested inside it.
    function computeOwn (phase: PerfPhase) {
      // Find direct children: phases nested inside this one that aren't
      // themselves nested inside another child (to avoid double-subtraction).
      const children = allPhases.filter(other =>
        other !== phase
        && other.startTime >= phase.startTime
        && other.endTime <= phase.endTime,
      )
      const directChildren = children.filter(child =>
        !children.some(other =>
          other !== child
          && child.startTime >= other.startTime
          && child.endTime <= other.endTime,
        ),
      )

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

    return {
      totalDuration,
      totalMemoryDelta: {
        rss: globalMemoryAfter.rss - this.#globalMemoryBefore.rss,
        heapUsed: globalMemoryAfter.heapUsed - this.#globalMemoryBefore.heapUsed,
      },
      phases: allPhases.map((p) => {
        const own = computeOwn(p)
        return {
          name: p.name,
          duration: p.duration,
          ownDuration: own.ownDuration,
          memoryBefore: p.memoryBefore,
          memoryAfter: p.memoryAfter,
          memoryDelta: p.memoryDelta,
          ownMemoryDelta: own.ownMemoryDelta,
        }
      }),
      slowHooks: this.#computeSlowHooks(new Set(allPhases.map(p => p.name))),
      modules: [...this.#modules].sort((a, b) => b.setupTime - a.setupTime),
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
        .sort((a, b) => {
          const aTotal = Object.values(a.hooks).reduce((s, h) => s + h.totalTime, 0)
          const bTotal = Object.values(b.hooks).reduce((s, h) => s + h.totalTime, 0)
          return bTotal - aTotal
        }),
      timestamp: new Date().toISOString(),
    }
  }

  printReport (options?: { title?: string }): void {
    const report = this.getReport()

    // Sub-phases are module:* and vite:* — everything else goes in the main table
    const isSubPhase = (name: string) => name.startsWith('module:') || name.startsWith('vite:')
    const topPhases = report.phases.filter(p => !isSubPhase(p.name))
    const subPhases = report.phases.filter(p => isSubPhase(p.name))

    consola.log('')
    consola.log(colors.bold(colors.cyan(` ${options?.title || 'Nuxt Performance Report'}`)))
    consola.log('')

    const colPhase = 24
    const colDuration = 10
    const colRss = 14
    const colHeap = 14
    const maxDuration = Math.max(...topPhases.map(p => p.ownDuration), 1)

    const header = [
      pad(colors.bold('Phase'), colPhase),
      pad(colors.bold('Duration'), colDuration, 'right'),
      pad(colors.bold('RSS Delta'), colRss, 'right'),
      pad(colors.bold('Heap Delta'), colHeap, 'right'),
    ].join('  ')
    consola.log(`  ${header}`)

    const separator = '  ' + colors.dim('─'.repeat(colPhase + colDuration + colRss + colHeap + 6))
    consola.log(separator)

    const maxRss = Math.max(...topPhases.map(p => Math.abs(p.ownMemoryDelta.rss)), 1)
    const barMax = 20

    for (const phase of topPhases) {
      const dur = phase.ownDuration
      const rss = phase.ownMemoryDelta.rss
      const heap = phase.ownMemoryDelta.heapUsed

      // Duration bar: log scale so small phases are still visible next to dominant ones
      const durBar = dur > 0
        ? Math.max(1, Math.round((Math.log(dur + 1) / Math.log(maxDuration + 1)) * (barMax / 2)))
        : 0
      // Memory bar: proportional to RSS delta
      const memBar = Math.abs(rss) > 0
        ? Math.max(0, Math.round((Math.abs(rss) / maxRss) * (barMax / 2)))
        : 0

      const durColor = dur > 1000 ? colors.red : dur > 200 ? colors.yellow : colors.green
      const memColor = Math.abs(rss) > 50 * 1024 * 1024 ? colors.red : Math.abs(rss) > 10 * 1024 * 1024 ? colors.yellow : colors.green

      const bar = durColor('█'.repeat(durBar)) + memColor('░'.repeat(memBar))

      const row = [
        pad(phase.name, colPhase),
        pad(durColor(formatDuration(dur)), colDuration, 'right'),
        pad(memColor((rss >= 0 ? '+' : '') + formatBytes(rss)), colRss, 'right'),
        pad((heap >= 0 ? '+' : '') + formatBytes(heap), colHeap, 'right'),
      ].join('  ')
      consola.log(`  ${row}  ${bar}`)
    }

    consola.log(separator)
    const totalRow = [
      pad(colors.bold('Total'), colPhase),
      pad(colors.bold(formatDuration(report.totalDuration)), colDuration, 'right'),
      pad(colors.bold((report.totalMemoryDelta.rss >= 0 ? '+' : '') + formatBytes(report.totalMemoryDelta.rss)), colRss, 'right'),
      pad(colors.bold((report.totalMemoryDelta.heapUsed >= 0 ? '+' : '') + formatBytes(report.totalMemoryDelta.heapUsed)), colHeap, 'right'),
    ].join('  ')
    consola.log(`  ${totalRow}`)
    consola.log('')

    const significantModules = report.modules.filter(m => m.setupTime > 5)
    if (significantModules.length > 0) {
      consola.log(colors.bold(` Modules`))
      consola.log('')
      for (const mod of significantModules) {
        const durColor = mod.setupTime > 500 ? colors.red : mod.setupTime > 100 ? colors.yellow : colors.dim
        consola.log(`  ${colors.dim('•')} ${mod.name} ${colors.dim('—')} ${durColor(formatDuration(mod.setupTime))}`)
      }
      consola.log('')
    }

    if (report.bundlerPlugins.length > 0) {
      const rows: Array<{ plugin: string, hook: string, timing: PluginHookTiming }> = []
      for (const plugin of report.bundlerPlugins) {
        for (const [hook, timing] of Object.entries(plugin.hooks)) {
          if (timing.avgTime > 0.5) {
            rows.push({ plugin: plugin.name, hook, timing })
          }
        }
      }
      rows.sort((a, b) => b.timing.avgTime - a.timing.avgTime)

      if (rows.length > 0) {
        consola.log(colors.bold(` Bundler Plugins`))
        consola.log('')
        for (const { plugin, hook, timing } of rows.slice(0, 15)) {
          const durColor = timing.avgTime > 10 ? colors.red : timing.avgTime > 2 ? colors.yellow : colors.dim
          const avgLabel = formatDuration(timing.avgTime) + '/file'
          const maxLabel = timing.maxTime > timing.avgTime * 2 ? `, max ${formatDuration(timing.maxTime)}` : ''
          consola.log(`  ${colors.dim('•')} ${plugin} ${colors.dim(hook)} ${colors.dim('—')} ${durColor(avgLabel)}${colors.dim(maxLabel)} ${colors.dim(`(${timing.count} calls)`)}`)
        }
        consola.log('')
      }
    }

    if (report.slowHooks.length > 0) {
      consola.log(colors.bold(colors.yellow(` Slow Hooks (>${SLOW_HOOK_THRESHOLD_MS}ms own time)`)))
      consola.log('')
      for (const hook of report.slowHooks) {
        const durColor = hook.ownDuration > 500 ? colors.red : hook.ownDuration > 200 ? colors.yellow : colors.dim
        const ownLabel = hook.ownDuration !== hook.duration
          ? `${formatDuration(hook.ownDuration)} own / ${formatDuration(hook.duration)} total`
          : formatDuration(hook.ownDuration)
        consola.log(`  ${colors.dim('•')} ${hook.name} ${colors.dim('—')} ${durColor(ownLabel)} ${colors.dim(`(${hook.phase})`)}`)
      }
      consola.log('')
    }

    const significantSubs = subPhases.filter(p => p.duration > 5)
    if (significantSubs.length > 0) {
      consola.log(colors.bold(` Details`))
      consola.log('')
      for (const phase of significantSubs) {
        const durColor = phase.duration > 500 ? colors.red : phase.duration > 100 ? colors.yellow : colors.dim
        consola.log(`  ${colors.dim('•')} ${phase.name} ${colors.dim('—')} ${durColor(formatDuration(phase.duration))}`)
      }
      consola.log('')
    }
  }

  async writeReport (buildDir: string, options?: { quiet?: boolean }): Promise<string> {
    const report = this.getReport()
    const reportPath = join(buildDir, 'perf-report.json')
    await mkdir(buildDir, { recursive: true })
    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8')
    if (!options?.quiet) {
      consola.log(colors.dim(` Full report written to ${reportPath}`))
      consola.log('')
    }
    return reportPath
  }

  printSessionSummary (): void {
    const report = this.getReport()
    const elapsed = formatDuration(report.totalDuration)

    consola.log('')
    consola.log(colors.bold(colors.cyan(' Nuxt Session Summary')))
    consola.log('')
    consola.log(`  ${colors.dim('Session duration:')} ${elapsed}`)
    consola.log(`  ${colors.dim('Memory:')} ${(report.totalMemoryDelta.rss >= 0 ? '+' : '') + formatBytes(report.totalMemoryDelta.rss)} RSS, ${(report.totalMemoryDelta.heapUsed >= 0 ? '+' : '') + formatBytes(report.totalMemoryDelta.heapUsed)} heap`)
    consola.log('')

    if (report.bundlerPlugins.length > 0) {
      const rows: Array<{ plugin: string, hook: string, timing: PluginHookTiming }> = []
      for (const plugin of report.bundlerPlugins) {
        for (const [hook, timing] of Object.entries(plugin.hooks)) {
          if (timing.avgTime > 0.5) {
            rows.push({ plugin: plugin.name, hook, timing })
          }
        }
      }
      rows.sort((a, b) => b.timing.avgTime - a.timing.avgTime)

      if (rows.length > 0) {
        consola.log(colors.bold(` Bundler Plugins (session total)`))
        consola.log('')
        for (const { plugin, hook, timing } of rows.slice(0, 15)) {
          const durColor = timing.avgTime > 10 ? colors.red : timing.avgTime > 2 ? colors.yellow : colors.dim
          const avgLabel = formatDuration(timing.avgTime) + '/file'
          const maxLabel = timing.maxTime > timing.avgTime * 2 ? `, max ${formatDuration(timing.maxTime)}` : ''
          consola.log(`  ${colors.dim('•')} ${plugin} ${colors.dim(hook)} ${colors.dim('—')} ${durColor(avgLabel)}${colors.dim(maxLabel)} ${colors.dim(`(${timing.count} calls)`)}`)
        }
        consola.log('')
      }
    }
  }

  dispose (): void {
    this.#unsubscribe?.()
  }

  #computeSlowHooks (reportedPhaseNames: Set<string>): SlowHook[] {
    const hooks: SlowHook[] = []
    for (const hp of this.#hookPhases) {
      if (hp.duration < SLOW_HOOK_THRESHOLD_MS) { continue }

      const hookName = hp.name.slice(5) // strip "hook:" prefix

      // Skip hooks already shown as phases in the main table
      if (reportedPhaseNames.has(hookName)) { continue }

      // Subtract time attributed to phases (manual + promoted hooks) that overlap
      let attributedTime = 0
      for (const phase of this.#phases) {
        const overlapStart = Math.max(phase.startTime, hp.startTime)
        const overlapEnd = Math.min(phase.endTime, hp.endTime)
        if (overlapEnd > overlapStart) {
          attributedTime += overlapEnd - overlapStart
        }
      }
      // Also subtract time from other hook phases that are nested inside this one
      for (const other of this.#hookPhases) {
        if (other === hp) { continue }
        if (other.startTime >= hp.startTime && other.endTime <= hp.endTime) {
          attributedTime += other.duration
        }
      }

      const ownDuration = round(hp.duration - round(attributedTime))
      if (ownDuration >= SLOW_HOOK_THRESHOLD_MS) {
        const parentPhase = this.#phases.find(p =>
          p.startTime <= hp.startTime && p.endTime >= hp.endTime,
        )
        hooks.push({
          name: hookName,
          duration: hp.duration,
          ownDuration,
          phase: parentPhase?.name || '(between phases)',
        })
      }
    }
    return hooks.sort((a, b) => b.ownDuration - a.ownDuration)
  }
}
