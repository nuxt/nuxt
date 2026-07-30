import type { Nitro, NitroRouteConfig } from 'nitro/types'
import type { NuxtPage } from 'nuxt/schema'
import { defu } from 'defu'
import { joinURL } from 'ufo'
import { vueRouterToRou3 } from 'unrouting'
import { toArray } from '../utils.ts'

// Chosen not to collide with a real route rule, so matching it surfaces only the
// wildcard rules that apply across a whole glob region.
const PROBE_SEGMENT = '__nuxt_route_rule_probe__'

const ROUTE_WILDCARD_RE = /\*\*(?::\w+)?|\*|:\w+/g
function globToProbePath (route: string): string {
  return route.replace(ROUTE_WILDCARD_RE, PROBE_SEGMENT)
}

const TRAILING_SLASH_RE = /\/$/

export interface RouteRuleCoverageOptions {
  isCovered: (rules: NitroRouteConfig) => boolean
  mark: (page: NuxtPage, covered: boolean) => void
  /** Excluded pages count as uncovered, which also keeps every ancestor that renders them. */
  filter?: (page: NuxtPage) => boolean
}

/**
 * Mark every page that route rules guarantee is never rendered in one of the two
 * bundles, so `normalizeRoutes` can stub its component out of that bundle.
 *
 * A page qualifies only when every path it can be reached by is covered: its
 * canonical path, each alias, and the whole subtree below it. Anything that
 * cannot be proven statically counts as uncovered.
 */
export function markPagesCoveredByRouteRule (pages: NuxtPage[], nitro: Nitro, options: RouteRuleCoverageOptions): boolean {
  if (!('routing' in nitro)) { return false }

  const routeRules = nitro.routing.routeRules
  const isPathCovered = (path: string) =>
    options.isCovered(defu({} as NitroRouteConfig, ...routeRules.matchAll('', path).reverse()))

  // A dynamic pattern serves a subset of the region below its first dynamic
  // segment (`/products/*` and `/products/*/reviews` both live under
  // `/products`), so it only counts when that whole region is covered with no
  // more specific rule carving out an exception.
  function patternIsCovered (pattern: string): boolean {
    if (!pattern.includes(':') && !pattern.includes('*')) {
      return isPathCovered(pattern.length > 1 ? pattern.replace(TRAILING_SLASH_RE, '') : pattern)
    }
    const segments = pattern.split('/')
    const dynamicAt = segments.findIndex(segment => segment.includes(':') || segment.includes('*'))
    const prefix = segments.slice(0, dynamicAt).join('/') || '/'
    const probe = (prefix === '/' ? '' : prefix) + '/' + PROBE_SEGMENT
    if (!isPathCovered(probe)) { return false }
    const within = prefix === '/' ? '/' : prefix + '/'
    for (const { route } of routeRules.routes) {
      if (route !== prefix && !route.startsWith(within)) { continue }
      if (!isPathCovered(globToProbePath(route))) { return false }
    }
    return true
  }

  // A Vue Router path collapses to several rou3 patterns when it contains finite
  // alternations, and all of them have to be covered.
  function pathIsCovered (path: string): boolean {
    const { patterns } = vueRouterToRou3(path, { collapse: true })
    return patterns.length > 0 && patterns.every(patternIsCovered)
  }

  function markPages (pages: NuxtPage[], prefix: string): boolean {
    let allCovered = true
    for (const page of pages) {
      // child paths are relative to their parent unless declared absolute
      const path = page.path.startsWith('/') ? page.path : joinURL(prefix, page.path)
      const aliases = toArray(page.alias || []).map(alias => alias.startsWith('/') ? alias : joinURL(prefix, alias))
      let covered = options.filter?.(page) === false
        ? false
        : [path, ...aliases].every(pathIsCovered)
      if (page.children?.length) {
        covered = markPages(page.children, path) && covered
      }
      options.mark(page, covered)
      allCovered &&= covered
    }
    return allCovered
  }

  return markPages(pages, '/')
}
