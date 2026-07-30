/**
 * End-to-end `nuxt dev` benchmark.
 *
 * Measures the metrics a developer actually feels, rather than internal build
 * timings:
 *
 * - `coldReady`   spawn -> dev server accepting connections (empty `.nuxt`, empty vite cache)
 * - `firstSSR`    the first navigation: how long the very first HTML response takes
 * - `warmSSR`     median SSR response once the graph is hot
 * - `hmrServer`   save a component -> a fresh SSR response contains the change
 * - `hmrClient`   save a component -> the vite HMR websocket emits an update
 * - `hmrStyle`    save a component's `<style>` block -> the HMR websocket emits an update
 * - `hmrUnused`   save a component nothing on the current page imports -> HMR update
 * - `hmrPage`     save a page (route-level change) -> SSR reflects it
 * - `restart`     save `nuxt.config` -> dev server ready again
 * - `warmReady`   restart the process with caches populated -> ready
 * - `rss`         resident memory once idle after all of the above
 * - `rssRoutes`   resident memory after every route has been server-rendered once
 *
 * Usage:
 *   node scripts/bench/dev-bench.ts --fixture .bench/medium --label baseline --out .bench/results/baseline.json
 *   node scripts/bench/dev-bench.ts --compare .bench/results/baseline.json .bench/results/candidate.json
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'

const TIMEOUT = Number(process.env.BENCH_TIMEOUT || 120_000)

const step = (message: string) => process.stderr.write(`  · ${message}\n`)

async function timed<T> (name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    step(`${name} (${Math.round(performance.now() - start)}ms)`)
  }
}

export interface BenchResult {
  label: string
  fixture: string
  env: Record<string, string>
  metrics: Record<string, number | null>
  samples: Record<string, number[]>
  notes: string[]
  timestamp: string
}

function now () {
  return performance.now()
}

async function waitFor (predicate: () => boolean | Promise<boolean>, { timeout = TIMEOUT, interval = 20, what = 'condition' } = {}) {
  const start = now()
  while (now() - start < timeout) {
    if (await predicate()) { return now() - start }
    await new Promise(r => setTimeout(r, interval))
  }
  throw new Error(`Timed out after ${Math.round(timeout)}ms waiting for ${what}`)
}

interface DevProcess {
  child: ChildProcess
  output: () => string
  url: string
  kill: () => Promise<void>
}

async function startDev (fixture: string, options: { env?: Record<string, string>, port: number, cwd: string }): Promise<{ proc: DevProcess, readyMs: number }> {
  const start = now()
  let output = ''
  const child = spawn(process.execPath, [
    resolve(options.cwd, 'node_modules/@nuxt/cli/bin/nuxi.mjs'),
    'dev',
    fixture,
    '--no-fork',
    '--port',
    String(options.port),
  ], {
    cwd: options.cwd,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NUXT_TELEMETRY_DISABLED: '1',
      NUXT_IGNORE_LOCK: '1',
      FORCE_COLOR: '0',
      ...options.env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout!.on('data', (d) => { output += d.toString() })
  child.stderr!.on('data', (d) => { output += d.toString() })

  let exited = false
  child.on('exit', () => { exited = true })

  const url = `http://localhost:${options.port}`

  await waitFor(async () => {
    if (exited) { throw new Error(`Dev server exited early:\n${output.slice(-4000)}`) }
    try {
      const res = await fetch(url + '/__bench_ping__', { signal: AbortSignal.timeout(2000) })
      // any response (including 404) means the listener is up
      return res.status > 0
    } catch {
      return false
    }
  }, { what: 'dev server to listen' })

  const readyMs = now() - start

  return {
    proc: {
      child,
      output: () => output,
      url,
      async kill () {
        if (exited) { return }
        child.kill('SIGTERM')
        await new Promise<void>((r) => {
          const t = setTimeout(() => { child.kill('SIGKILL'); r() }, 5000)
          child.on('exit', () => { clearTimeout(t); r() })
        })
      },
    },
    readyMs,
  }
}

async function timedFetch (url: string) {
  const start = now()
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  const body = await res.text()
  return { ms: now() - start, status: res.status, body }
}

function median (values: number[]) {
  if (!values.length) { return null }
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/**
 * Connects to Vite's HMR websocket so we can time the client-facing half of a
 * hot update, not just the SSR half. Vite requires the `vite-hmr` subprotocol.
 */
const PORT_MARKER = '__port:'

async function connectHmr (url: string, base: string): Promise<{ next: (match: (msg: any) => boolean) => Promise<number>, close: () => void }> {
  // `base` may carry an explicit hmr port as `__port:<port><path>` (see readHmrPath)
  let wsUrl = url.replace(/^http/, 'ws') + base
  if (base.startsWith(PORT_MARKER)) {
    const rest = base.slice(PORT_MARKER.length)
    const slash = rest.indexOf('/')
    const port = slash === -1 ? rest : rest.slice(0, slash)
    const path = slash === -1 ? '/' : rest.slice(slash)
    wsUrl = url.replace(/^http/, 'ws').replace(/:\d+$/, `:${port}`) + path
  }
  const socket = new WebSocket(wsUrl, 'vite-hmr')
  const waiters: Array<{ match: (m: any) => boolean, resolve: (t: number) => void }> = []

  socket.addEventListener('message', (event) => {
    let payload: any
    try { payload = JSON.parse(String(event.data)) } catch { return }
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i]!.match(payload)) {
        waiters[i]!.resolve(now())
        waiters.splice(i, 1)
      }
    }
  })

  await new Promise<void>((res, rej) => {
    socket.addEventListener('open', () => res(), { once: true })
    socket.addEventListener('error', () => rej(new Error(`Could not open HMR socket at ${wsUrl}`)), { once: true })
    setTimeout(() => rej(new Error(`HMR socket timeout at ${wsUrl}`)), 15_000)
  })

  return {
    next (match) {
      return new Promise<number>((resolve, reject) => {
        waiters.push({ match, resolve })
        setTimeout(() => reject(new Error('No matching HMR message received')), 60_000)
      })
    },
    close: () => socket.close(),
  }
}

/**
 * The highest-numbered generated component: pages only fan out to the first few
 * hundred, so this one has no importers in the rendered route.
 */
function findUnusedComponent (fixtureDir: string): string | undefined {
  const dir = resolve(fixtureDir, 'app/components')
  if (!existsSync(dir)) { return }
  const files = readdirSync(dir).filter(f => /^Widget\d+\.vue$/.test(f)).sort()
  const last = files.at(-1)
  return last && resolve(dir, last)
}

async function editFile (path: string, mutate: (source: string) => string) {
  const source = await readFile(path, 'utf8')
  await writeFile(path, mutate(source), 'utf8')
  return () => writeFile(path, source, 'utf8')
}

export async function runBench (options: {
  fixture: string
  cwd: string
  label: string
  port: number
  env?: Record<string, string>
  repeats?: number
  /** extra `defineNuxtConfig` body inserted into the fixture config for this run */
  configPatch?: string
}): Promise<BenchResult> {
  const { fixture, cwd, label, port } = options
  const repeats = options.repeats ?? 3
  const metrics: Record<string, number | null> = {}
  const samples: Record<string, number[]> = {}
  const notes: string[] = []

  const fixtureDir = resolve(cwd, fixture)
  const strays = findStrayDevServers()
  if (strays.length) {
    throw new Error(`Refusing to measure while ${strays.length} other dev server(s) are running (pids ${strays.join(', ')}). Run \`sh scripts/bench/kill-dev.sh\`.`)
  }

  // A partially generated fixture yields impressively fast, entirely meaningless
  // numbers, so refuse to measure one.
  for (const required of ['nuxt.config.ts', 'app/app.vue', 'app/pages/index.vue', 'app/components/Widget0000.vue']) {
    if (!existsSync(resolve(fixtureDir, required))) {
      throw new Error(`Fixture at ${fixtureDir} is incomplete (missing ${required}). Re-run scripts/bench/generate-fixture.ts.`)
    }
  }
  {
    // Always strip a patch left behind by a previous run, otherwise a run without
    // `--config-patch` silently inherits the last run's flags.
    const configPath = resolve(fixtureDir, 'nuxt.config.ts')
    const source = readFileSync(configPath, 'utf8')
    const marker = '/* bench:config-patch */'
    const escaped = marker.replace(/[*/]/g, '\\$&')
    const cleaned = source.replace(new RegExp(`\\s*${escaped}[\\s\\S]*?${escaped}`), '')
    const patched = options.configPatch
      ? cleaned.replace('export default defineNuxtConfig({', `export default defineNuxtConfig({
  ${marker}
  ${options.configPatch}
  ${marker}`)
      : cleaned
    if (patched !== source) {
      writeFileSync(configPath, patched, 'utf8')
    }
  }
  const record = (key: string, value: number) => {
    (samples[key] ??= []).push(value)
  }

  // --- cold start -----------------------------------------------------------
  rmSync(resolve(fixtureDir, '.nuxt'), { recursive: true, force: true })
  rmSync(resolve(fixtureDir, 'node_modules/.cache'), { recursive: true, force: true })
  rmSync(resolve(fixtureDir, 'node_modules/.vite'), { recursive: true, force: true })
  rmSync(resolve(cwd, 'node_modules/.vite'), { recursive: true, force: true })

  const { proc, readyMs } = await timed('cold start', () => startDev(fixture, { cwd, port, env: options.env }))
    .then(r => ({ proc: r.proc, readyMs: r.readyMs }))
  metrics.coldReady = readyMs

  try {
    // --- first SSR ----------------------------------------------------------
    const first = await timed('first SSR', () => timedFetch(proc.url + '/'))
    metrics.firstSSR = first.ms
    if (first.status !== 200) {
      notes.push(`First SSR responded ${first.status}: ${first.body.slice(0, 400)}`)
    }

    // --- warm SSR -----------------------------------------------------------
    await timed('warm SSR', async () => {
      for (let i = 0; i < 5; i++) { await timedFetch(proc.url + '/') }
      for (let i = 0; i < 20; i++) {
        record('warmSSR', (await timedFetch(proc.url + '/')).ms)
      }
    })
    metrics.warmSSR = median(samples.warmSSR!)

    // --- full client graph, as a browser would load it ----------------------
    {
      const start = now()
      const graph = await timed('client graph crawl', () => crawlClientGraph(proc.url, first.body))
      metrics.firstClientLoad = now() - start
      metrics.clientModules = graph.modules
      metrics.clientBytes = graph.bytes
      if (graph.reloads) { notes.push(`${graph.reloads} module(s) triggered a dependency re-optimization`) }
    }

    // second crawl: everything is transformed and cached, so this isolates the
    // dev server's steady-state cost of serving an already-warm graph
    {
      const start = now()
      const graph = await crawlClientGraph(proc.url, first.body)
      metrics.warmClientLoad = now() - start

      const reloadStart = now()
      const revalidation = await revalidateClientGraph(proc.url, graph.etags)
      metrics.reloadClientLoad = now() - reloadStart
      if (revalidation.resent) {
        notes.push(`${revalidation.resent} module(s) were resent in full on revalidation`)
      }
    }

    // --- cold navigation to an unvisited route ------------------------------
    const coldRoute = await timed('cold route SSR', () => timedFetch(proc.url + '/page-7'))
    metrics.coldRouteSSR = coldRoute.status === 200 ? coldRoute.ms : null
    if (coldRoute.status !== 200) { notes.push(`/page-7 responded ${coldRoute.status}`) }

    // --- HMR ----------------------------------------------------------------
    let hmr: Awaited<ReturnType<typeof connectHmr>> | undefined
    try {
      hmr = await connectHmr(proc.url, await readHmrPath(proc.url))
    } catch (error) {
      notes.push(`HMR socket unavailable: ${(error as Error).message}`)
    }

    const componentPath = resolve(fixtureDir, 'app/components/Widget0000.vue')
    if (existsSync(componentPath)) {
      // Vite only emits a client `update` for modules the client environment
      // has actually loaded. Without a browser, request the module through the
      // dev server so it exists in the client graph.
      await timed('prime client graph', async () => {
        for (const file of ['app/components/Widget0000.vue', 'app/pages/index.vue']) {
          await fetch(`${proc.url}/_nuxt/@fs${resolve(fixtureDir, file)}`, { signal: AbortSignal.timeout(60_000) }).catch(() => {})
        }
      })
      step('component HMR')
      for (let i = 0; i < repeats; i++) {
        const token = `hmr-token-${Date.now()}-${i}`
        const updatePromise = hmr?.next(m => m.type === 'update' || m.type === 'full-reload')
          .then(t => record('hmrClient', t - start), () => { notes.push('client HMR update not observed') })
        const start = now()
        await editFile(componentPath, src => src.replace(/(class="hmr-marker">)[^<]*/, `$1${token}`))
        await waitFor(async () => (await timedFetch(proc.url + '/')).body.includes(token), { what: `SSR to reflect ${token}`, timeout: 60_000 })
        record('hmrServer', now() - start)
        await updatePromise
      }
      metrics.hmrServer = median(samples.hmrServer ?? [])
      metrics.hmrClient = median(samples.hmrClient ?? [])
    }

    // --- style-only and unused-component edits --------------------------------
    // Both should be cheap: neither can change what Nuxt writes into `.nuxt`, and
    // neither invalidates a module the SSR render depends on.
    if (hmr && existsSync(componentPath)) {
      step('style-only HMR')
      for (let i = 0; i < repeats; i++) {
        const gap = 4 + i + 1
        const update = hmr.next(m => m.type === 'update' || m.type === 'full-reload')
        const start = now()
        await editFile(componentPath, src => src.replace(/gap: \d+px/, `gap: ${gap}px`))
        try {
          record('hmrStyle', await update - start)
        } catch {
          notes.push('style-only HMR update not observed')
        }
      }
      metrics.hmrStyle = median(samples.hmrStyle ?? [])
    }

    const unusedComponent = findUnusedComponent(fixtureDir)
    if (hmr && unusedComponent) {
      step('unused component HMR')
      await fetch(`${proc.url}/_nuxt/@fs${unusedComponent}`, { signal: AbortSignal.timeout(60_000) }).catch(() => {})
      for (let i = 0; i < repeats; i++) {
        const update = hmr.next(m => m.type === 'update' || m.type === 'full-reload')
        const start = now()
        await editFile(unusedComponent, src => src.replace(/(class="hmr-marker">)[^<]*/, `$1unused-${Date.now()}-${i}`))
        try {
          record('hmrUnused', await update - start)
        } catch {
          notes.push('unused-component HMR update not observed')
        }
      }
      metrics.hmrUnused = median(samples.hmrUnused ?? [])
    }

    const pagePath = resolve(fixtureDir, 'app/pages/index.vue')
    if (existsSync(pagePath)) {
      step('page HMR')
      for (let i = 0; i < repeats; i++) {
        const token = `page-token-${Date.now()}-${i}`
        const start = now()
        await editFile(pagePath, src => src.replace(/(class="hmr-page-marker">)[^<]*/, `$1${token}`))
        await waitFor(async () => (await timedFetch(proc.url + '/')).body.includes(token), { what: `SSR to reflect ${token}` })
        record('hmrPage', now() - start)
      }
      metrics.hmrPage = median(samples.hmrPage!)
    }

    // --- adding a new component (template regeneration path) ----------------
    {
      step('add component')
      const newComponent = resolve(fixtureDir, 'app/components/BenchNewlyAdded.vue')
      const token = `added-${Date.now()}`
      const start = now()
      mkdirSync(dirname(newComponent), { recursive: true })
      writeFileSync(newComponent, `<template><span>${token}</span></template>\n`, 'utf8')
      await editFile(pagePath, src => src.replace('<h1>', '<BenchNewlyAdded />\n    <h1>'))

      try {
        await waitFor(async () => (await timedFetch(proc.url + '/')).body.includes(token), { what: 'new component to be auto-imported', timeout: 30_000 })
        metrics.addComponent = now() - start
      } catch (error) {
        notes.push(`addComponent: ${(error as Error).message}`)
        metrics.addComponent = null
      }
      rmSync(newComponent, { force: true })
      await editFile(pagePath, src => src.replace('<BenchNewlyAdded />\n    ', ''))
    }

    // --- server route HMR ---------------------------------------------------
    const serverRoute = resolve(fixtureDir, 'server/api/bench-0.ts')
    if (existsSync(serverRoute)) {
      step('server route HMR')
      for (let i = 0; i < repeats; i++) {
        const token = Date.now() + i
        const start = now()
        await writeFile(serverRoute, `import { defineHandler } from 'h3'\n\nexport default defineHandler(() => ({ route: 0, token: ${token} }))\n`, 'utf8')
        try {
          await waitFor(async () => (await timedFetch(proc.url + '/api/bench-0')).body.includes(String(token)), { what: 'server route reload', timeout: 30_000 })
          record('hmrServerRoute', now() - start)
        } catch (error) {
          notes.push(`hmrServerRoute: ${(error as Error).message}`)
        }
      }
      metrics.hmrServerRoute = median(samples.hmrServerRoute ?? [])
    }

    hmr?.close()

    // --- idle memory --------------------------------------------------------
    metrics.rss = await residentMemory(proc.child.pid!)

    // --- config restart -----------------------------------------------------
    {
      step('config restart')
      const configPath = resolve(fixtureDir, 'nuxt.config.ts')
      const start = now()
      const restore = await editFile(configPath, src => src.replace('devtools: { enabled: false },', `devtools: { enabled: false },\n  appId: 'bench-${Date.now()}',`))
      try {
        await waitFor(async () => {
          try {
            const res = await timedFetch(proc.url + '/')
            return res.status === 200
          } catch { return false }
        }, { what: 'restart after config change', timeout: 90_000 })
        metrics.restart = now() - start
      } catch (error) {
        notes.push(`restart: ${(error as Error).message}`)
        metrics.restart = null
      }
      await restore()
    }

    // --- memory once every route has been server-rendered -------------------
    {
      step('render every route')
      const pages = readdirSync(resolve(fixtureDir, 'app/pages'))
        .filter(f => f.endsWith('.vue') && f !== 'index.vue')
        .map(f => '/' + f.replace(/\.vue$/, ''))
      for (const page of pages) {
        await timedFetch(proc.url + page).catch(() => {})
      }
      await new Promise(r => setTimeout(r, 2000))
      metrics.rssRoutes = await residentMemory(proc.child.pid!)
    }
  } finally {
    await proc.kill()
  }

  // --- warm start -----------------------------------------------------------
  const warm = await timed('warm start', () => startDev(fixture, { cwd, port: port + 1, env: options.env }))
  metrics.warmReady = warm.readyMs
  try {
    metrics.warmFirstSSR = (await timedFetch(warm.proc.url + '/')).ms
  } finally {
    await warm.proc.kill()
  }

  return {
    label,
    fixture,
    env: options.env ?? {},
    metrics,
    samples,
    notes,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Walks the client module graph the way a browser would: fetch the entry
 * modules named in the SSR'd HTML, parse their import specifiers, and keep
 * going until the graph is exhausted.
 *
 * This is the metric that captures dependency prebundling and per-module
 * transform cost, neither of which the SSR path exercises. It is the closest
 * proxy we have for "how long until the dev page is actually interactive"
 * without driving a real browser.
 */
export async function crawlClientGraph (baseUrl: string, html: string, options: { concurrency?: number, limit?: number } = {}) {
  const concurrency = options.concurrency ?? 8
  const limit = options.limit ?? 4000

  const seen = new Set<string>()
  const queue: string[] = []
  for (const match of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) {
    queue.push(match[1]!)
  }

  let fetched = 0
  let bytes = 0
  let reloads = 0
  const etags = new Map<string, string>()

  const IMPORT_RE = /(?:^|[^\w$.])(?:import|export)[\s\S]*?from\s*["']([^"']+)["']|(?:^|[^\w$.])import\s*\(\s*["']([^"']+)["']\s*\)|(?:^|[^\w$.])import\s*["']([^"']+)["']/g

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length && seen.size < limit) {
      const specifier = queue.shift()
      if (!specifier || seen.has(specifier)) { continue }
      seen.add(specifier)
      // only crawl same-origin, server-served module urls
      if (!specifier.startsWith('/')) { continue }
      let source: string
      try {
        const res = await fetch(baseUrl + specifier, { signal: AbortSignal.timeout(120_000) })
        if (!res.ok) { continue }
        const type = res.headers.get('content-type') || ''
        const etag = res.headers.get('etag')
        if (etag) { etags.set(specifier, etag) }
        source = await res.text()
        fetched++
        bytes += source.length
        if (!type.includes('javascript')) { continue }
      } catch {
        continue
      }
      // a dep discovered mid-crawl makes vite re-optimize and reload the page
      if (source.includes('__vite__optimizeDeps') || source.includes('new dependencies optimized')) { reloads++ }
      for (const match of source.matchAll(IMPORT_RE)) {
        const found = match[1] || match[2] || match[3]
        if (!found || !found.startsWith('/') || seen.has(found)) { continue }
        queue.push(found)
      }
    }
  })

  await Promise.all(workers)
  return { modules: fetched, bytes, reloads, etags }
}

/**
 * Replays a warm graph as a browser soft-reload does: one conditional GET per
 * module. Vite serves dev modules `Cache-Control: no-cache` with an ETag, so a
 * reload is N revalidations rather than N transfers. This is the number a
 * developer feels on cmd-R; `warmClientLoad` is what they feel on a hard reload
 * or with "disable cache" enabled in devtools, which is common.
 */
async function revalidateClientGraph (baseUrl: string, etags: Map<string, string>, concurrency = 8) {
  const list = [...etags]
  let revalidated = 0
  let resent = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (list.length) {
      const entry = list.pop()
      if (!entry) { break }
      try {
        const res = await fetch(baseUrl + entry[0], {
          headers: { 'if-none-match': entry[1] },
          signal: AbortSignal.timeout(60_000),
        })
        if (res.status === 304) { revalidated++ } else { resent++; await res.text() }
      } catch { /* best effort */ }
    }
  })
  await Promise.all(workers)
  return { revalidated, resent }
}

/**
 * Vite bakes the websocket host/port/path into `@vite/client` as `__HMR_*`
 * constants. Reading them back is more robust than guessing from `base`, which
 * Nuxt rewrites to `buildAssetsDir`.
 */
async function readHmrPath (url: string): Promise<string> {
  for (const candidate of ['/_nuxt/@vite/client', '/@vite/client']) {
    try {
      const res = await fetch(url + candidate, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) { continue }
      const source = await res.text()
      // vite inlines the ws url as a template literal ending in the hmr base
      const path = source.match(/hmrPort \|\| importMetaUrl\.port\}\$\{?"([^"]*)"/)?.[1] ?? '/'
      const port = source.match(/hmrPort = (\d+|null)/)?.[1]
      return port && port !== 'null' ? `${PORT_MARKER}${port}${path}` : path
    } catch { /* best effort */ }
  }
  return '/'
}

/**
 * A dev server left over from an earlier run competes for CPU and keeps writing
 * into the fixture, which quietly invalidates every number in the report. Cheap
 * to detect, so always detect it.
 */
function findStrayDevServers (): number[] {
  const found: number[] = []
  try {
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry) || Number(entry) === process.pid) { continue }
      try {
        const cmdline = readFileSync(`/proc/${entry}/cmdline`, 'utf8').replaceAll('\0', ' ')
        if (/(?:nuxi|nuxt)\.mjs\s+dev(?:\s|$)/.test(cmdline)) { found.push(Number(entry)) }
      } catch { /* best effort */ }
    }
  } catch { /* best effort */ }
  return found
}

/**
 * `ps` is not guaranteed to exist (slim containers), so read `/proc` directly
 * on Linux and fall back to `ps` elsewhere.
 */
async function residentMemory (pid: number): Promise<number | null> {
  const tree = (rows: Array<{ rss: number, pid: number, ppid: number }>) => {
    const wanted = new Set([pid])
    let changed = true
    while (changed) {
      changed = false
      for (const row of rows) {
        if (!wanted.has(row.pid) && wanted.has(row.ppid)) { wanted.add(row.pid); changed = true }
      }
    }
    return rows.filter(r => wanted.has(r.pid)).reduce((sum, r) => sum + r.rss, 0)
  }

  try {
    const { readdirSync, readFileSync } = await import('node:fs')
    const rows: Array<{ rss: number, pid: number, ppid: number }> = []
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) { continue }
      try {
        const stat = readFileSync(`/proc/${entry}/stat`, 'utf8')
        // the comm field may contain spaces/parens, so split after the final ')'
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
        const statm = readFileSync(`/proc/${entry}/statm`, 'utf8').split(' ')
        rows.push({ pid: Number(entry), ppid: Number(fields[1]), rss: Number(statm[1]) * 4096 })
      } catch { /* best effort */ }
    }
    if (rows.length) { return tree(rows) }
  } catch { /* best effort */ }

  try {
    const { execSync } = await import('node:child_process')
    const out = execSync('ps -o rss=,pid=,ppid= -A', { encoding: 'utf8' })
    return tree(out.trim().split('\n').map((line) => {
      const [rss, p, pp] = line.trim().split(/\s+/).map(Number)
      return { rss: rss! * 1024, pid: p!, ppid: pp! }
    }))
  } catch {
    return null
  }
}

const UNITS: Record<string, (v: number) => string> = {
  rss: v => `${(v / 1024 / 1024).toFixed(0)} MB`,
  rssRoutes: v => `${(v / 1024 / 1024).toFixed(0)} MB`,
  clientBytes: v => `${(v / 1024 / 1024).toFixed(1)} MB`,
  clientModules: v => String(v),
}

function formatValue (key: string, value: number | null) {
  if (value == null) { return '—' }
  return UNITS[key] ? UNITS[key](value) : `${Math.round(value)} ms`
}

export function printComparison (results: BenchResult[]) {
  const keys = [...new Set(results.flatMap(r => Object.keys(r.metrics)))]
  const nameWidth = Math.max(...keys.map(k => k.length), 14)
  const colWidth = 16

  console.log('')
  console.log(['Metric'.padEnd(nameWidth), ...results.map(r => r.label.padStart(colWidth))].join('  '))
  console.log('-'.repeat(nameWidth + results.length * (colWidth + 2)))
  for (const key of keys) {
    const cells = results.map((r) => {
      const value = r.metrics[key] ?? null
      const baseline = results[0]!.metrics[key] ?? null
      let cell = formatValue(key, value)
      if (results.length > 1 && r !== results[0] && value != null && baseline) {
        const delta = ((value - baseline) / baseline) * 100
        cell += ` (${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%)`
      }
      return cell.padStart(colWidth)
    })
    console.log([key.padEnd(nameWidth), ...cells].join('  '))
  }
  console.log('')
  for (const result of results) {
    for (const note of result.notes) {
      console.log(`  [${result.label}] ${note}`)
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const get = (flag: string, fallback?: string) => {
    const i = args.indexOf(flag)
    return i === -1 ? fallback : args[i + 1]
  }

  const compareIndex = args.indexOf('--compare')
  if (compareIndex !== -1) {
    const files = args.slice(compareIndex + 1).filter(a => !a.startsWith('--'))
    printComparison(files.map(f => JSON.parse(readFileSync(f, 'utf8'))))
    process.exit(0)
  }

  const env: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env') {
      const [key, ...rest] = args[i + 1]!.split('=')
      env[key!] = rest.join('=')
    }
  }

  const result = await runBench({
    fixture: get('--fixture', '.bench/medium')!,
    cwd: process.cwd(),
    label: get('--label', 'run')!,
    port: Number(get('--port', '3300')),
    repeats: Number(get('--repeats', '3')),
    configPatch: get('--config-patch'),
    env,
  })

  const out = get('--out')
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true })
    writeFileSync(resolve(out), JSON.stringify(result, null, 2), 'utf8')
    console.log(`Wrote ${out}`)
  }
  printComparison([result])
}
