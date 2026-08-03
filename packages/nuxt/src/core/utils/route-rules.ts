import type { Nitro } from 'nitro/types'
import { decodeRoutePath } from './index.ts'

type RouteRulesRouter = Nitro['routing']['routeRules']

/**
 * Normalise a route-rule key or lookup path: decode percent-encoding, then case-fold when
 * `fold` is set. Keys are matched in decoded form so that a rule may be authored either
 * decoded (`/测试`, the usual case) or encoded (`/%E6%B5%8B%E8%AF%95`, the form the page route
 * and the request path take). Decoding must precede case folding, or a percent-encoded
 * non-ASCII character would never fold.
 *
 * @internal
 */
export function normalizeRouteRulePath (path: string, fold: boolean): string {
  const decoded = decodeRoutePath(path)
  return fold ? decoded.toLowerCase() : decoded
}

/**
 * Build a sibling route-rules router whose keys are decoded (and, when `fold` is set,
 * lower-cased), mirroring the normalised lookup path used at runtime.
 *
 * `onDuplicate` is called when two distinct keys normalise onto the same path; the later
 * key wins.
 *
 * @internal
 */
// TODO: nitro does not export its `Router` class or a way to clone a router, so the sibling
// has to be constructed from the live instance and seeded through `_update`. Replace both once
// nitro exposes a public API for this.
export function createNormalizedRouteRulesRouter (source: RouteRulesRouter, baseURL: string | undefined, fold: boolean, onDuplicate?: (existing: string, route: string, key: string) => void): RouteRulesRouter {
  const NormalizedRouter = source.constructor as new (baseURL?: string) => RouteRulesRouter
  const normalized = new NormalizedRouter(normalizeRouteRulePath(String(baseURL || ''), fold))
  const normalizedKeys = new Map<string, string>()
  normalized._update(source.routes.map((route) => {
    if (typeof route.route !== 'string') { return route }
    const key = normalizeRouteRulePath(route.route, fold)
    const existing = normalizedKeys.get(key)
    if (existing !== undefined && existing !== route.route) {
      onDuplicate?.(existing, route.route, key)
    }
    normalizedKeys.set(key, route.route)
    return { ...route, route: key }
  }))
  return normalized
}
