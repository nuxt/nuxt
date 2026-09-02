import type { Nitro, NitroRouteConfig } from 'nitro/types'
import type { NuxtPage } from 'nuxt/schema'
import { defu } from 'defu'
import { joinURL } from 'ufo'
import { vueRouterToRou3 } from 'unrouting'
import { toArray } from '../utils.ts'

const UNESCAPE_RE = /\\(.)/g

/**
 * Derive a segment no literal rule can match, by extending a base until it collides with none of
 * the static segments in the rule set. Matching the probe then surfaces only the wildcard rules
 * that apply across a whole glob region.
 */
function createProbeSegment (routes: readonly { route: string }[]): string {
  const literals = new Set<string>()
  for (const { route } of routes) {
    for (const segment of route.split('/')) {
      literals.add(segment)
      literals.add(segment.replace(UNESCAPE_RE, '$1'))
    }
  }
  let probe = '__nuxt_route_rule_probe__'
  while (literals.has(probe)) { probe += '_' }
  return probe
}

const ROU3_PARAM_RE = /^:[\w-]+/
const ROU3_MODIFIER_RE = /^[?+*]/

/** Length of the `(...)` group starting at `index`, or `0` if there is none. */
function groupLength (segment: string, index: number): number {
  if (segment[index] !== '(') { return 0 }
  let depth = 0
  for (let cursor = index; cursor < segment.length; cursor++) {
    const char = segment[cursor]
    if (char === '\\') { cursor++ } else if (char === '(') { depth++ } else if (char === ')' && --depth === 0) { return cursor + 1 - index }
  }
  return segment.length - index
}

/**
 * Turn one rou3 segment into the literal text it would match, substituting the probe for any
 * dynamic token. Escapes are honoured in both directions: `\:` is a literal `:` rather than a
 * param, and the backslash is dropped because rou3 matches against the unescaped path.
 */
function segmentToProbe (segment: string, probeSegment: string): { probe: string, dynamic: boolean } {
  let probe = ''
  let dynamic = false
  let index = 0
  while (index < segment.length) {
    const char = segment[index]!
    if (char === '\\') {
      probe += segment[index + 1] ?? ''
      index += 2
      continue
    }
    let length = 0
    if (char === '*') {
      length = segment.startsWith('**', index) ? 2 : 1
      length += ROU3_PARAM_RE.exec(segment.slice(index + length))?.[0].length ?? 0
    } else if (char === ':') {
      length = ROU3_PARAM_RE.exec(segment.slice(index))?.[0].length ?? 0
    } else if (char === '(') {
      length = groupLength(segment, index)
    }
    if (!length) {
      probe += char
      index++
      continue
    }
    dynamic = true
    probe += probeSegment
    index += length
    index += groupLength(segment, index)
    index += ROU3_MODIFIER_RE.exec(segment.slice(index))?.[0].length ?? 0
  }
  return { probe, dynamic }
}

function patternToProbePath (pattern: string, probeSegment: string): string {
  return pattern.split('/').map(segment => segmentToProbe(segment, probeSegment).probe).join('/')
}

const TRAILING_SLASH_RE = /\/$/

export interface RouteRuleCoverageOptions {
  isCovered: (rules: NitroRouteConfig) => boolean
  /** `resolvedPath` is the full route the page is reachable by, unlike the possibly relative `page.path`. */
  mark: (page: NuxtPage, covered: boolean, resolvedPath: string) => void
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
  const PROBE_SEGMENT = createProbeSegment(routeRules.routes)
  const isPathCovered = (path: string) =>
    options.isCovered(defu({} as NitroRouteConfig, ...routeRules.matchAll('', path).reverse()))

  // A dynamic pattern serves a subset of the region below its first dynamic
  // segment (`/products/*` and `/products/*/reviews` both live under
  // `/products`), so it only counts when that whole region is covered with no
  // more specific rule carving out an exception.
  function patternIsCovered (pattern: string): boolean {
    const segments = pattern.split('/').map(segment => segmentToProbe(segment, PROBE_SEGMENT))
    const dynamicAt = segments.findIndex(segment => segment.dynamic)
    if (dynamicAt === -1) {
      const path = segments.map(segment => segment.probe).join('/')
      return isPathCovered(path.length > 1 ? path.replace(TRAILING_SLASH_RE, '') : path)
    }
    const prefix = segments.slice(0, dynamicAt).map(segment => segment.probe).join('/') || '/'
    const probe = (prefix === '/' ? '' : prefix) + '/' + PROBE_SEGMENT
    if (!isPathCovered(probe)) { return false }
    // rule keys are raw rou3 patterns, so the region filter compares them against the raw prefix
    const rawPrefix = pattern.split('/').slice(0, dynamicAt).join('/') || '/'
    const within = rawPrefix === '/' ? '/' : rawPrefix + '/'
    for (const { route } of routeRules.routes) {
      if (route !== rawPrefix && !route.startsWith(within)) { continue }
      if (!isPathCovered(patternToProbePath(route, PROBE_SEGMENT))) { return false }
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
      options.mark(page, covered, path)
      allCovered &&= covered
    }
    return allCovered
  }

  return markPages(pages, '/')
}
