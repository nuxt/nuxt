import type { RouteLocationNormalizedGeneric, RouteRecordNormalized, RouteRecordRaw, Router } from 'vue-router'

// Keep in sync with `LAZY_ROUTE_GROUP_KEY` in `../utils.ts`
export const LAZY_ROUTE_GROUP_KEY = '__nuxtRouteGroup'

type GroupLoader = () => Promise<{ default: RouteRecordRaw[] }>
type GroupMarker = [groupId: number, position: number]

export interface LazyRouteDiscovery {
  /**
   * Load the lazy route groups needed to fully resolve `url`.
   * Returns `undefined` when the url only matches already-discovered routes.
   */
  discover: (url: string) => Promise<unknown> | undefined
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

export function setupLazyRouteDiscovery (router: Router, initialRoutes: readonly RouteRecordRaw[], initialLoaders: ReadonlyArray<GroupLoader | undefined>, onNavigationDiscovery?: () => void): LazyRouteDiscovery {
  let topLevel = [...initialRoutes]
  let loaders = initialLoaders
  const loading = new Map<number, Promise<void>>()
  // groups that finished loading: their markers must never count as pending again,
  // even if a marker survives the swap (e.g. build skew), or navigation would loop
  const settled = new Set<number>()
  let generation = 0

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
    const pending = pendingGroups(to)
    if (pending.length) {
      onNavigationDiscovery?.()
      await Promise.all(pending)
      // retry the navigation: it now resolves against the discovered records
      return to.fullPath
    }
  })

  return {
    discover (url) {
      const pending = pendingGroups(router.resolve(url))
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
      rebuildTable()
      const currentPath = router.currentRoute.value.fullPath
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
