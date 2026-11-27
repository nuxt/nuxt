import { readdir, stat } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { join, relative } from 'pathe'
import type { Nuxt, NuxtBuildEnvironment, NuxtBuildFile, NuxtPrerenderFailure, NuxtPrerenderRoute } from '@nuxt/schema'

import { useNuxt } from '../context.ts'

/**
 * A production bundle that has started, reported with {@link startBuildEnvironment}.
 *
 * @internal
 */
export interface BuildEnvironmentReport {
  /**
   * Report the bundle as written, through the `build:environment:done` hook. Call this once
   * its files are on disk.
   * @param outDir Absolute path of the directory the bundle was written to
   * @param files Paths of the files written, relative to `outDir`. Every file in `outDir` when omitted.
   */
  done: (outDir: string, files?: Iterable<string>) => Promise<void>
}

/**
 * Report a production bundle starting, through the `build:environment:start` hook.
 *
 * @internal
 */
export async function startBuildEnvironment (environment: NuxtBuildEnvironment, nuxt: Nuxt = useNuxt()): Promise<BuildEnvironmentReport> {
  const start = performance.now()
  await nuxt.callHook('build:environment:start', environment)
  return {
    async done (outDir, files) {
      const duration = performance.now() - start
      await nuxt.callHook('build:environment:done', environment, {
        duration,
        outDir,
        files: files ? await statFiles(outDir, files) : await listFiles(outDir),
      })
    },
  }
}

async function statFiles (outDir: string, paths: Iterable<string>): Promise<NuxtBuildFile[]> {
  const files = await Promise.all([...new Set(paths)].map(async (path) => {
    const stats = await stat(join(outDir, path)).catch(() => null)
    return stats?.isFile() ? { path: relative(outDir, join(outDir, path)), size: stats.size } : undefined
  }))
  return files.filter(file => file !== undefined)
}

async function listFiles (outDir: string): Promise<NuxtBuildFile[]> {
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true }).catch(() => [])
  return statFiles(outDir, entries.filter(entry => entry.isFile()).map(entry => relative(outDir, join(entry.parentPath, entry.name))))
}

/**
 * The parts of a route Nitro reports from its `prerender:route` hook that Nuxt reads, in the
 * shape of either Nitro 2 or Nitro 3.
 */
interface NitroPrerenderRoute {
  route: string
  fileName?: string
  generateTimeMS?: number
  skip?: boolean
  error?: Error & { status?: number, statusText?: string, statusCode?: number, statusMessage?: string }
  linkedFrom?: unknown
}

const LEADING_SLASH_RE = /^\/+/
const TRAILING_SLASH_RE = /\/+$/

interface NitroPrerenderHooks {
  hook: (name: any, callback: any) => unknown
}

/**
 * Report the prerendering of a Nitro build (Nitro 2 or 3) through the `build:prerender:*` hooks.
 *
 * @internal
 */
export function reportNitroPrerender (nitro: { hooks: NitroPrerenderHooks, options?: { baseURL?: string } }, nuxt: Nuxt = useNuxt()): void {
  let routes: Set<string> | undefined
  let queued = 0
  let start = performance.now()
  let emitted = 0

  nitro.hooks.hook('prerender:routes', (queue: Set<string>) => {
    routes = queue
    // Nitro adds crawled routes to this set and removes each route as it starts rendering it,
    // so only counting additions tells how many routes have been queued in total
    const add = queue.add.bind(queue)
    queue.add = (route) => {
      if (!queue.has(route)) { queued++ }
      return add(route)
    }
  })
  nitro.hooks.hook('prerender:init', () => {
    start = performance.now()
    emitted = 0
    queued = routes?.size ?? 0
    return nuxt.callHook('build:prerender:start', { routes: queued })
  })
  nitro.hooks.hook('prerender:route', (route: NitroPrerenderRoute) => {
    emitted++
    return nuxt.callHook('build:prerender:route', normalizeNitroPrerenderRoute(route, Math.max(queued, emitted), nitro.options?.baseURL))
  })
  nitro.hooks.hook('prerender:done', (result: { prerenderedRoutes?: unknown[], failedRoutes?: NitroPrerenderRoute[] }) => {
    return nuxt.callHook('build:prerender:done', {
      duration: performance.now() - start,
      written: result.prerenderedRoutes?.length ?? 0,
      failed: (result.failedRoutes ?? []).map((route): NuxtPrerenderFailure => ({
        route: route.route,
        ...normalizeNitroPrerenderError(route.error),
        ...normalizeLinkedFrom(route.linkedFrom, nitro.options?.baseURL),
      })),
    })
  })
}

/**
 * Normalise a route reported by Nitro 2 or Nitro 3 from its `prerender:route` hook.
 *
 * @internal
 */
export function normalizeNitroPrerenderRoute (route: NitroPrerenderRoute, total: number, baseURL?: string): NuxtPrerenderRoute {
  if (route.error) {
    return {
      route: route.route,
      duration: route.generateTimeMS ?? 0,
      total,
      skipped: false,
      error: normalizeNitroPrerenderError(route.error),
      ...normalizeLinkedFrom(route.linkedFrom, baseURL),
    }
  }
  return {
    route: route.route,
    duration: route.generateTimeMS ?? 0,
    total,
    skipped: !!route.skip,
    ...route.skip || !route.fileName ? {} : { fileName: route.fileName.replace(LEADING_SLASH_RE, '') },
  }
}

function normalizeLinkedFrom (linkedFrom: unknown, baseURL = '/'): { linkedFrom?: string[] } {
  if (!Array.isArray(linkedFrom) || !linkedFrom.every(page => typeof page === 'string')) {
    return {}
  }
  const base = baseURL.replace(TRAILING_SLASH_RE, '')
  return {
    linkedFrom: linkedFrom.map(page => !base || (page !== base && !page.startsWith(`${base}/`)) ? page : page.slice(base.length) || '/'),
  }
}

function normalizeNitroPrerenderError (error: NitroPrerenderRoute['error']): NonNullable<NuxtPrerenderRoute['error']> {
  const status = error?.status ?? error?.statusCode
  return {
    ...typeof status === 'number' ? { status } : {},
    message: error?.statusText || error?.statusMessage || error?.message || 'Unknown error',
  }
}
