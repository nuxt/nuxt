import { defu } from 'defu'
import { findAllRoutes } from 'rou3'
import type { RouterContext } from 'rou3'
import { decodeRoutePath } from './index.ts'

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
 * Resolve the route rules that apply to `path`, merged most-specific-last.
 *
 * The router is expected to have been populated with keys normalised by
 * {@link normalizeRouteRulePath} under the same `fold`, so that lookups match them.
 *
 * @internal
 */
export function resolveRouteRules<T extends Record<string, any>> (router: RouterContext<T>, path: string, fold: boolean): T {
  const matches = findAllRoutes(router, undefined, normalizeRouteRulePath(path, fold))
  return defu({} as T, ...matches.map(match => match.data).reverse())
}
