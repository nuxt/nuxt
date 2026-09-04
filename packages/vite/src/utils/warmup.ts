import { isBuiltin } from 'node:module'
import type { IncomingMessage } from 'node:http'
import { performance } from 'node:perf_hooks'
import { logger } from '@nuxt/kit'
import { join, normalize, relative } from 'pathe'
import { withoutBase } from 'ufo'
import { isCSSRequest } from 'vite'
import type { DevEnvironment } from 'vite'

export interface WarmupOptions {
  /** Vite `config.root`, used to turn absolute entry paths into dev server URLs. */
  root: string
  /** Vite `config.base`, stripped from module graph urls before transforming. */
  base?: string
  /** Stop the crawl after this many modules have been transformed. */
  maxModules?: number
  /** Stop the crawl after this many milliseconds. */
  maxDuration?: number
  /** Number of modules transformed in parallel. */
  concurrency?: number
  /** Called before each transform; return `true` to abandon the rest of the crawl. */
  shouldStop?: () => boolean
  /** Called before each transform; while `true` the crawl idles rather than transforming. */
  shouldPause?: () => boolean
}

export interface WarmupResult {
  /** Number of modules transformed; modules already in the graph do not count. */
  modules: number
  /** Number of module graph urls the crawl reached, transformed or not. */
  visited: number
  duration: number
  stopped: boolean
}

const PAUSE_POLL_INTERVAL = 20

/**
 * Requests that will make the browser walk the module graph itself, at which point
 * speculative transforms are pure contention for the same plugin containers.
 */
export function isNavigationRequest (req: IncomingMessage) {
  const mode = req.headers['sec-fetch-mode']
  if (mode) {
    return mode === 'navigate'
  }
  return !!req.headers.accept?.includes('text/html')
}

// https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/warmup.ts#L62-L70
function fileToUrl (file: string, root: string) {
  const url = relative(root, file)
  if (url[0] === '.') {
    return join('/@fs/', normalize(file))
  }
  return '/' + normalize(url)
}

function normaliseURL (url: string, base: string) {
  url = withoutBase(url, base)
  if (url.startsWith('/@id/')) {
    url = url.slice('/@id/'.length).replace('__x00__', '\0')
  }
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) {
    return url
  }
  // `?import` is added when the browser fetches a module, and would otherwise
  // duplicate the entry we already hold for the bare url
  const params = url.slice(queryIndex + 1).split('&').filter(param => param && param !== 'import' && param !== 'import=')
  const path = url.slice(0, queryIndex)
  return params.length ? `${path}?${params.join('&')}` : path
}

/**
 * Transform the given entries and, unlike Vite's built-in warmup, keep following
 * their imports through the module graph until it is exhausted or a bound is hit.
 *
 * Most of the transform cost of a Nuxt dev server's first page load is in transitive
 * dependencies of the entry rather than in the entry itself, so warming only the
 * listed files warms almost nothing.
 */
export async function warmupViteServer (
  environment: DevEnvironment,
  entries: string[],
  options: WarmupOptions,
): Promise<WarmupResult> {
  const { root, base = '/', maxModules = Number.POSITIVE_INFINITY, maxDuration = Number.POSITIVE_INFINITY, concurrency = 4, shouldStop, shouldPause } = options

  const start = performance.now()
  const seen = new Set<string>()
  const queue: string[] = []
  let transformed = 0
  let visited = 0
  let stopped = false

  // a worker with an empty queue can only exit once no other worker is still able
  // to discover imports, so idle workers park here until woken by a state change
  let active = 0
  const waiters = new Set<() => void>()
  const wake = () => {
    for (const resolve of waiters) { resolve() }
    waiters.clear()
  }

  const enqueue = (url: string) => {
    const normalised = normaliseURL(url, base)
    if (!normalised || seen.has(normalised) || isBuiltin(normalised)) { return }
    seen.add(normalised)
    queue.push(normalised)
    wake()
  }

  for (const entry of entries) {
    enqueue(fileToUrl(entry, root))
  }

  const isExhausted = () => {
    if (stopped) { return true }
    if (transformed >= maxModules || performance.now() - start > maxDuration || shouldStop?.()) {
      stopped = true
      wake()
      return true
    }
    return false
  }

  const visit = async (url: string) => {
    visited++
    let mod
    try {
      mod = await environment.moduleGraph.getModuleByUrl(url)
      if (!mod?.transformResult) {
        await environment.transformRequest(url)
        transformed++
        mod = await environment.moduleGraph.getModuleByUrl(url)
      }
    } catch (error) {
      logger.debug(`Vite warmup for ${url} failed with:`, error)
      return
    }

    // CSS modules have no further imports to fetch over the network
    if (isCSSRequest(url)) { return }

    for (const dep of mod?.importedModules || []) {
      enqueue(dep.url)
    }
  }

  const worker = async () => {
    while (!isExhausted()) {
      if (shouldPause?.()) {
        await new Promise(resolve => setTimeout(resolve, PAUSE_POLL_INTERVAL))
        continue
      }
      if (!queue.length) {
        if (!active) { break }
        await new Promise<void>(resolve => waiters.add(resolve))
        continue
      }
      const url = queue.shift()!
      active++
      try {
        // yield between modules so an incoming request is never queued behind speculative work
        await new Promise(resolve => setImmediate(resolve))
        await visit(url)
      } finally {
        active--
        wake()
      }
    }
    // let any parked worker re-evaluate now that this one is gone
    wake()
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return { modules: transformed, visited, duration: performance.now() - start, stopped }
}
