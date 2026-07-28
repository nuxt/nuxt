import type { Nitro } from 'nitro/types'

type RouteRulesRouter = Nitro['routing']['routeRules']

/**
 * Build a sibling route-rules router whose keys are lower-cased, mirroring the case-folded
 * lookup path used when routing is not `sensitive`.
 *
 * `onDuplicate` is called when two distinct keys fold onto the same path; the later key wins.
 *
 * @internal
 */
// TODO: nitro does not export its `Router` class or a way to clone a router, so the sibling
// has to be constructed from the live instance and seeded through `_update`. Replace both once
// nitro exposes a public API for this.
export function createFoldedRouteRulesRouter (source: RouteRulesRouter, baseURL: string | undefined, onDuplicate?: (existing: string, route: string) => void): RouteRulesRouter {
  const FoldedRouter = source.constructor as new (baseURL?: string) => RouteRulesRouter
  const folded = new FoldedRouter(String(baseURL || '').toLowerCase())
  const foldedKeys = new Map<string, string>()
  folded._update(source.routes.map((route) => {
    if (typeof route.route !== 'string') { return route }
    const key = route.route.toLowerCase()
    const existing = foldedKeys.get(key)
    if (existing !== undefined && existing !== route.route) {
      onDuplicate?.(existing, route.route)
    }
    foldedKeys.set(key, route.route)
    return { ...route, route: key }
  }))
  return folded
}
