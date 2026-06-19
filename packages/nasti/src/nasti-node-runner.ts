import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { nastiNodeFetch, nastiNodeOptions } from '#nasti-node'

// Minimal SSR module runner executed inside the Nitro process. Nasti's
// `moduleRunnerTransform` emits the same bindings as Vite's module runner
// (`__vite_ssr_import__`, `__vite_ssr_exports__`, `__vite_ssr_exportAll__`,
// `__vite_ssr_dynamic_import__`, `__vite_ssr_import_meta__`), so we evaluate fetched code
// in an async function providing exactly those. This is the Nasti analogue of
// `vite-node/client`'s runner (which is not reusable here as Nasti ships no public runner).

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as
  new (...args: string[]) => (...args: unknown[]) => Promise<void>

interface ModuleCacheEntry {
  exports: Record<string, any>
  promise?: Promise<Record<string, any>>
}

const moduleCache = new Map<string, ModuleCacheEntry>()
const dev = nastiNodeOptions.baseURL !== undefined

function normalizeId (id: string) {
  return id.replace(/\/\//g, '/')
}

async function resolveId (id: string, importer?: string): Promise<{ id: string, external: boolean }> {
  // Bare specifiers and node builtins are resolved/loaded natively (externalized).
  if (id.startsWith('node:') || (!id.startsWith('.') && !id.startsWith('/'))) {
    return { id, external: true }
  }
  const resolved = await nastiNodeFetch.resolveId(id, importer).catch(() => null)
  if (!resolved) {
    return { id, external: false }
  }
  if (typeof resolved === 'string') {
    return { id: resolved, external: false }
  }
  return { id: resolved.id, external: !!resolved.external }
}

async function executeId (rawId: string): Promise<Record<string, any>> {
  const id = normalizeId(rawId)

  const cached = moduleCache.get(id)
  if (cached) {
    return cached.promise ? cached.promise : cached.exports
  }

  const exports: Record<string, any> = Object.create(null)
  Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module', enumerable: false })
  const entry: ModuleCacheEntry = { exports }
  moduleCache.set(id, entry)

  const promise = (async () => {
    const fetched = await nastiNodeFetch.fetchModule(id)
    if (fetched.externalize) {
      const mod = await import(fetched.externalize)
      entry.exports = mod
      return mod
    }

    const ssrImport = async (dep: string) => {
      const resolved = await resolveId(dep, id)
      if (resolved.external) {
        return import(resolved.id)
      }
      return executeId(resolved.id)
    }
    const ssrDynamicImport = (dep: string) => ssrImport(dep)
    const ssrExportAll = (sourceModule: Record<string, any>) => {
      for (const key in sourceModule) {
        if (key !== 'default' && !(key in exports)) {
          Object.defineProperty(exports, key, {
            enumerable: true,
            configurable: true,
            get: () => sourceModule[key],
          })
        }
      }
    }
    const importMeta = {
      url: pathToFileURL(fetched.file || id).href,
      env: { ...process.env, SSR: true, DEV: dev, PROD: !dev, MODE: dev ? 'development' : 'production' },
      hot: undefined,
    }

    const run = new AsyncFunction(
      '__vite_ssr_import__',
      '__vite_ssr_dynamic_import__',
      '__vite_ssr_exports__',
      '__vite_ssr_exportAll__',
      '__vite_ssr_import_meta__',
      '"use strict";' + (fetched.code || ''),
    )
    await run(ssrImport, ssrDynamicImport, exports, ssrExportAll, importMeta)
    entry.exports = exports
    return exports
  })()

  entry.promise = promise
  try {
    return await promise
  } finally {
    entry.promise = undefined
  }
}

/** Drop cached modules whose ids were invalidated since the previous render. */
function invalidate (ids: Iterable<string>): Set<string> {
  const removed = new Set<string>()
  for (const id of ids) {
    const norm = normalizeId(id)
    if (moduleCache.delete(norm)) {
      removed.add(norm)
    }
  }
  return removed
}

export interface NastiNodeRunner {
  executeId: (id: string) => Promise<Record<string, any>>
  executeFile: (file: string) => Promise<Record<string, any>>
  invalidate: (ids: Iterable<string>) => Set<string>
  moduleCache: Map<string, ModuleCacheEntry>
}

const runner: NastiNodeRunner = {
  executeId,
  executeFile: (file: string) => executeId(file),
  invalidate,
  moduleCache,
}

export default runner
