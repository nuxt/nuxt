import type { RouteLocationNormalizedGeneric, RouteLocationRaw, RouteRecordNormalized, RouteRecordRaw, Router } from 'vue-router'

// Keep in sync with `LAZY_ROUTE_GROUP_KEY` in `../utils.ts`
export const LAZY_ROUTE_GROUP_KEY = '__nuxtRouteGroup'

// A catch-all match (`/:slug(.*)*`) is never trusted as "known" — a specific route may be undiscovered.
const CATCHALL_RE = /\(\.\*\)/

type GroupLoader = () => Promise<{ default: RouteRecordRaw[] }>
type GroupMarker = [groupId: number, position: number]

/**
 * Resolves routes the client does not yet know about (by path and/or name) against the server
 * (`/__nuxt_routes`) or the prerendered fallback. Returns the top-level stub subtree(s) to patch in.
 */
export type ResolveRemoteRoutes = (query: { paths?: string[], names?: string[] }) => Promise<{ records: RouteRecordRaw[], notFound?: string[] } | undefined>

export interface LazyRouteDiscoveryOptions {
  /** Called when a navigation has to wait on discovery (drives the loading indicator). */
  onNavigationDiscovery?: () => void
  /** Fetches stubs for undiscovered routes. Omitted → only group discovery (routes must be known). */
  resolveRemote?: ResolveRemoteRoutes
}

export interface LazyRouteDiscovery {
  /**
   * Discover everything needed to fully resolve `to`: fetch its stub if undiscovered (by path, or by
   * name for `{ name }` targets), then load the lazy route group holding its full record. Returns
   * `undefined` when nothing is pending.
   */
  discover: (to: RouteLocationRaw) => Promise<unknown> | undefined
  /**
   * Replace the stub table and group loaders (dev HMR): rebuilds the route table,
   * re-discovers the current route and refreshes its meta.
   */
  reset: (routes: readonly RouteRecordRaw[], loaders: ReadonlyArray<GroupLoader | undefined>) => Promise<void>
}

function getMarker (route: { meta?: Record<PropertyKey, unknown> }): GroupMarker | undefined {
  const marker = route.meta?.[LAZY_ROUTE_GROUP_KEY]
  return Array.isArray(marker) ? marker as GroupMarker : undefined
}

function isCatchall (path: string | undefined): boolean {
  return !!path && CATCHALL_RE.test(path)
}

export function setupLazyRouteDiscovery (router: Router, initialRoutes: readonly RouteRecordRaw[], initialLoaders: ReadonlyArray<GroupLoader | undefined>, options: LazyRouteDiscoveryOptions = {}): LazyRouteDiscovery {
  const { onNavigationDiscovery, resolveRemote } = options
  let topLevel = [...initialRoutes]
  let loaders = initialLoaders
  const loading = new Map<number, Promise<void>>()
  // groups that finished loading: their markers must never count as pending again,
  // even if a marker survives the swap (e.g. build skew), or navigation would loop
  const settled = new Set<number>()
  // negative cache: paths that resolve to nothing more specific than a catch-all, queried only once
  const confirmedCatchall = new Set<string>()
  // in-flight stub fetches keyed by path, so concurrent navigations share one request
  const discovering = new Map<string, Promise<void>>()
  let generation = 0

  function safeResolve (to: RouteLocationRaw) {
    try {
      return router.resolve(to)
    } catch {
      return undefined
    }
  }

  function isSpecific (resolved: { matched: RouteLocationNormalizedGeneric['matched'] }): boolean {
    const leaf = resolved.matched.at(-1)
    return !!leaf && !isCatchall(leaf.path)
  }

  function rebuildTable () {
    // Same swap strategy as the dev HMR handler: re-add the whole top-level
    // tree, preserving routes added dynamically by user code.
    const addedRoutes = router.getRoutes().filter(route => !(route as InternalRouteRecord)._initial)
    router.clearRoutes()
    for (const route of topLevel) {
      router.addRoute(route)
    }
    for (const route of router.getRoutes()) {
      (route as InternalRouteRecord)._initial = true
    }
    for (const route of addedRoutes) {
      router.addRoute(route as RouteRecordRaw)
    }
  }

  // add a discovered top-level stub, marked `_initial` so a later `rebuildTable` preserves it
  function addTopLevelStub (record: RouteRecordRaw) {
    if (record.name != null && router.hasRoute(record.name)) { return }
    topLevel.push(record)
    const before = new Set(router.getRoutes())
    router.addRoute(record)
    for (const route of router.getRoutes()) {
      if (!before.has(route)) {
        (route as InternalRouteRecord)._initial = true
      }
    }
  }

  function ensureDiscovered (path: string): Promise<void> | undefined {
    if (!resolveRemote || confirmedCatchall.has(path)) { return }
    const current = safeResolve(path)
    if (current && isSpecific(current)) { return }
    let promise = discovering.get(path)
    if (!promise) {
      const discoverGeneration = generation
      promise = (async () => {
        let result
        try {
          result = await resolveRemote({ paths: [path] })
        } catch {
          result = undefined
        }
        if (generation !== discoverGeneration) { return }
        for (const record of result?.records ?? []) {
          addTopLevelStub(record)
        }
        // still not matched to a specific route → nothing more specific exists (or the transport
        // is unreachable); remember so we never re-query this path
        const after = safeResolve(path)
        if (!after || !isSpecific(after)) {
          confirmedCatchall.add(path)
        }
      })().finally(() => discovering.delete(path))
      discovering.set(path, promise)
    }
    return promise
  }

  // Discover a route by name (i18n `localePath` etc.). vue-router throws on an unknown name before
  // guards run, so this must complete before the navigation is issued.
  function ensureDiscoveredByName (name: string): Promise<void> | undefined {
    if (!resolveRemote || router.hasRoute(name)) { return }
    const key = `name:${name}`
    let promise = discovering.get(key)
    if (!promise) {
      const discoverGeneration = generation
      promise = (async () => {
        let result
        try {
          result = await resolveRemote({ names: [name] })
        } catch {
          result = undefined
        }
        if (generation !== discoverGeneration) { return }
        for (const record of result?.records ?? []) {
          addTopLevelStub(record)
        }
      })().finally(() => discovering.delete(key))
      discovering.set(key, promise)
    }
    return promise
  }

  function namedTarget (to: RouteLocationRaw): string | undefined {
    if (to && typeof to === 'object' && 'name' in to && to.name != null && typeof to.name !== 'symbol') {
      return String(to.name)
    }
    return undefined
  }

  function swapGroup (id: number, records: RouteRecordRaw[]) {
    const swaps: Array<[stub: RouteRecordRaw, record: RouteRecordRaw]> = []
    for (const [index, route] of topLevel.entries()) {
      const marker = getMarker(route)
      if (marker?.[0] !== id) { continue }
      const record = records[marker[1]]
      if (record) {
        topLevel[index] = record
        swaps.push([route, record])
      } else if (import.meta.dev) {
        console.warn(`[nuxt] Lazy route group ${id} is missing the record for ${JSON.stringify(route.path)}. The route table may be out of sync with the served chunks.`)
      }
    }
    if (swaps.every(([stub, record]) => stub.name && record.name === stub.name)) {
      // named records replace atomically without rebuilding the whole table
      const before = new Set(router.getRoutes())
      for (const [, record] of swaps) {
        router.addRoute(record)
      }
      for (const route of router.getRoutes()) {
        if (!before.has(route)) {
          (route as InternalRouteRecord)._initial = true
        }
      }
      return
    }
    rebuildTable()
  }

  function loadGroup (id: number): Promise<void> | undefined {
    const loader = loaders[id]
    if (!loader || settled.has(id)) { return }
    let promise = loading.get(id)
    if (!promise) {
      const loadGeneration = generation
      promise = loader().then((mod) => {
        if (generation !== loadGeneration) { return }
        settled.add(id)
        swapGroup(id, mod.default)
      }).catch((error) => {
        // allow a later navigation to retry a failed chunk load
        loading.delete(id)
        throw error
      })
      loading.set(id, promise)
    }
    return promise
  }

  function pendingGroups (route: { matched: RouteLocationNormalizedGeneric['matched'] }): Promise<void>[] {
    const promises: Promise<void>[] = []
    for (const record of route.matched) {
      const marker = getMarker(record)
      if (marker) {
        const promise = loadGroup(marker[0])
        if (promise) {
          promises.push(promise)
        }
      }
    }
    return promises
  }

  for (const route of router.getRoutes()) {
    (route as InternalRouteRecord)._initial = true
  }

  router.beforeEach(async (to) => {
    // discover the stub first when the target does not yet resolve to a specific route
    // (keyed on `path`, not `fullPath`: query/hash never affect which record matches)
    if (resolveRemote && !confirmedCatchall.has(to.path) && !isSpecific(to)) {
      const discovery = ensureDiscovered(to.path)
      if (discovery) {
        onNavigationDiscovery?.()
        await discovery
        // retry: the navigation now resolves against the patched-in stub
        return to.fullPath
      }
    }
    const pending = pendingGroups(to)
    if (pending.length) {
      onNavigationDiscovery?.()
      await Promise.all(pending)
      // retry the navigation: it now resolves against the discovered records
      return to.fullPath
    }
  })

  return {
    discover (to) {
      // named target the client has never seen → discover by name first (resolve would throw)
      const name = namedTarget(to)
      if (name !== undefined && resolveRemote && !router.hasRoute(name)) {
        return (async () => {
          await ensureDiscoveredByName(name)
          const after = safeResolve(to)
          if (after) {
            await Promise.all(pendingGroups(after))
          }
        })()
      }
      const resolved = safeResolve(to)
      const path = resolved?.path ?? (typeof to === 'string' ? to : undefined)
      if (path === undefined) { return }
      // stub not yet known → fetch it, then load its group
      if (resolveRemote && !confirmedCatchall.has(path) && !(resolved && isSpecific(resolved))) {
        return (async () => {
          await ensureDiscovered(path)
          const after = safeResolve(to)
          if (after) {
            await Promise.all(pendingGroups(after))
          }
        })()
      }
      const pending = resolved ? pendingGroups(resolved) : []
      if (pending.length) {
        return Promise.all(pending)
      }
    },
    async reset (routes, nextLoaders) {
      generation++
      topLevel = [...routes]
      loaders = nextLoaders
      loading.clear()
      settled.clear()
      confirmedCatchall.clear()
      discovering.clear()
      rebuildTable()
      const currentPath = router.currentRoute.value.fullPath
      await ensureDiscovered(router.currentRoute.value.path)
      await Promise.all(pendingGroups(router.resolve(currentPath)))
      // refresh meta of the active route against the new records
      const newRoute = router.resolve(currentPath)
      for (const key of Object.keys(router.currentRoute.value.meta)) {
        delete router.currentRoute.value.meta[key]
      }
      Object.assign(router.currentRoute.value.meta, newRoute.meta)
    },
  }
}

type InternalRouteRecord = RouteRecordNormalized & { _initial?: boolean }
