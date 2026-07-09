import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

// Resolves a path/name against the full lazy-stub table to its most-specific top-level stub subtree.
// Free of nitro/virtual imports so it is unit testable; `lazy-routes-server.ts` wraps it as a handler.

export interface LazyRouteResolveResponse {
  records: RouteRecordRaw[]
  notFound?: string[]
}

export interface LazyRouteResolveQuery {
  paths?: string[]
  names?: string[]
}

export interface LazyRouteResolver {
  /** Most-specific matching top-level stub subtree for `path`, or `undefined`. */
  resolve: (path: string) => RouteRecordRaw | undefined
  /** Top-level stub subtree registered under `name`, or `undefined`. */
  resolveName: (name: string) => RouteRecordRaw | undefined
  /** The full lazy-stub table (static-hosting fallback). */
  all: () => RouteRecordRaw[]
  /** Resolve many paths at once, deduped by name; unmatched paths collected in `notFound`. */
  resolveMany: (paths: string[]) => LazyRouteResolveResponse
  /** Resolve a mix of paths and names at once, deduped by name. */
  resolveQuery: (query: LazyRouteResolveQuery) => LazyRouteResolveResponse
}

// vue-router silently drops records without a component, so the matcher instance gets a dummy one.
const DUMMY = { render: () => null }

function withComponents (records: RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map(record => ({
    ...record,
    component: DUMMY,
    children: record.children ? withComponents(record.children as RouteRecordRaw[]) : undefined,
  }) as RouteRecordRaw)
}

export function createLazyRouteResolver (stubs: RouteRecordRaw[]): LazyRouteResolver {
  // name -> original (serializable) top-level stub subtree
  const byName = new Map<string, RouteRecordRaw>()
  for (const stub of stubs) {
    if (stub.name != null) {
      byName.set(String(stub.name), stub)
    }
  }

  const matcher = createRouter({ history: createMemoryHistory(), routes: withComponents(stubs) })

  function resolve (path: string): RouteRecordRaw | undefined {
    let resolved
    try {
      resolved = matcher.resolve(path)
    } catch {
      return undefined
    }
    const top = resolved.matched[0]
    if (!top || top.name == null) { return undefined }
    return byName.get(String(top.name))
  }

  function resolveName (name: string): RouteRecordRaw | undefined {
    return byName.get(name)
  }

  function resolveQuery (query: LazyRouteResolveQuery): LazyRouteResolveResponse {
    const records: RouteRecordRaw[] = []
    const notFound: string[] = []
    const seen = new Set<string>()
    const collect = (key: string, record: RouteRecordRaw | undefined) => {
      if (!record) {
        notFound.push(key)
        return
      }
      const name = String(record.name)
      if (!seen.has(name)) {
        seen.add(name)
        records.push(record)
      }
    }
    for (const path of query.paths ?? []) {
      collect(path, resolve(path))
    }
    for (const name of query.names ?? []) {
      collect(name, resolveName(name))
    }
    return { records, notFound }
  }

  function resolveMany (paths: string[]): LazyRouteResolveResponse {
    return resolveQuery({ paths })
  }

  return { resolve, resolveName, resolveMany, resolveQuery, all: () => stubs }
}
