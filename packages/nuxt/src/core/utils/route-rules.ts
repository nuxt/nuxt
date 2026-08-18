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

// bare placeholders only: renaming `:id(\d+)` or `:slug?` would change what they match
const DYNAMIC_SEGMENT_RE = /^(?::[$\w]+|\*)$/

// a name conflicts if another segment carries it and cannot itself be renamed away
function conflictsWithin (segments: string[], name: string, index: number): boolean {
  return segments.some((segment, i) =>
    i !== index &&
    segment.match(/^:([$\w]+)/)?.[1] === name &&
    (i < index || !DYNAMIC_SEGMENT_RE.test(segment)),
  )
}

/**
 * Rename dynamic segments in route rule keys, in place, so sibling segments share a single name.
 * `radix3` keys dynamic segments without their placeholder name, so `/:slug/about` and
 * `/:locale/:slug/about` collide and one silently loses its rules.
 *
 * @internal
 */
export function unifyDynamicRouteRuleSegments (routeRules: Record<string, Record<string, any>>): void {
  const unifiedNames = new Map<string, string>()
  const unified: Array<[string, Record<string, any>]> = []
  let clashed = false

  for (const [route, rules] of Object.entries(routeRules)) {
    const segments = route.split('/')
    const renames = new Map<string, string>()
    for (let index = 1; index < segments.length; index++) {
      const segment = segments[index]!
      if (!DYNAMIC_SEGMENT_RE.test(segment)) { continue }
      const group = segments.slice(0, index).join('/')
      let name = unifiedNames.get(group)
      if (!name) {
        name = segment === '*' ? `_${index}` : segment.slice(1)
        while (conflictsWithin(segments, name, index)) {
          name += '_'
        }
        unifiedNames.set(group, name)
      }
      if (segment === `:${name}` || conflictsWithin(segments, name, index)) { continue }
      clashed = true
      segments[index] = `:${name}`
      if (segment !== '*') {
        renames.set(segment.slice(1), name)
      }
    }
    if (renames.size) {
      // redirect/proxy targets reference placeholders by name
      for (const key of ['redirect', 'proxy']) {
        const target = rules[key]
        if (target?.to) {
          target.to = target.to.replace(/\/:([$\w]+)/g, (match: string, name: string) => renames.has(name) ? `/:${renames.get(name)}` : match)
        }
      }
    }
    unified.push([segments.join('/'), rules])
  }

  if (!clashed) { return }

  // mutate in place: `runtimeConfig.nitro.routeRules` references this object
  for (const route of Object.keys(routeRules)) {
    delete routeRules[route]
  }
  for (const [route, rules] of unified) {
    routeRules[route] = route in routeRules ? defu(rules, routeRules[route]) : rules
  }
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
