import { relative } from 'pathe'
import { joinURL } from 'ufo'
import { vueRouterToRou3 } from 'unrouting'

import { decodeRoutePath } from '../core/utils/index.ts'
import { toArray } from '../utils.ts'
import type { NuxtPage } from 'nuxt/schema'

/**
 * Whether a route can be normalised to the same form as an incoming request path.
 * A path carrying a `%` that is not a valid escape sequence cannot be decoded, and is
 * matched in its raw form on both sides: the pattern keeps the authored characters while
 * the request keeps the encoding the client sent, so the two can never meet.
 */
function isDecodable (route: string): boolean {
  if (!route.includes('%')) { return true }
  try {
    decodeURI(route)
    return true
  } catch {
    return false
  }
}

/** The absolute paths of a page and its aliases, resolving relative ones against each parent path. */
function resolvePageRoutes (page: NuxtPage, prefixes: string[]): Set<string> {
  const routes = new Set<string>()
  for (const route of [page.path, ...toArray(page.alias || [])]) {
    if (route.startsWith('/')) {
      routes.add(route)
    } else {
      for (const prefix of prefixes) {
        routes.add(joinURL(prefix, route))
      }
    }
  }
  return routes
}

const ROU3_SYNTAX_RE = /[*(){}\\]/g

/**
 * Map the rou3 pattern of every page path to the source files (relative to `srcDir`)
 * of the route records it renders, parents first. Patterns shared by unrelated pages
 * map to `undefined`. Returns `undefined` when any path cannot be converted exactly
 * (a trailing catch-all aside), or decodes to rou3 syntax, as rou3 could then pick a
 * different page than vue-router.
 */
export function collectRou3PageSources (pages: NuxtPage[], srcDir: string): Map<string, string[] | undefined> | undefined {
  const sources = new Map<string, string[] | undefined>()
  const owners = new Map<string, NuxtPage>()
  const collect = (pages: NuxtPage[], prefixes: string[], parentSources: string[], ancestors: NuxtPage[]): boolean => {
    for (const page of pages) {
      const pageSources = [...parentSources]
      for (const file of [page.file, ...Object.values(page.components || {})]) {
        if (file) { pageSources.push(relative(srcDir, file)) }
      }
      const routes = resolvePageRoutes(page, prefixes)
      for (const route of routes) {
        if (!isDecodable(route)) { return false }
        const { patterns, issues } = vueRouterToRou3(route, { collapse: true })
        if (!patterns.length || issues.some(issue => issue.type !== 'collapsed' || !route.endsWith(`:${issue.param}(.*)*`))) { return false }
        for (const pattern of patterns) {
          if (decodeRoutePath(pattern).match(ROU3_SYNTAX_RE)?.length !== pattern.match(ROU3_SYNTAX_RE)?.length) { return false }
          const owner = owners.get(pattern)
          const extendsExisting = !owner || (sources.get(pattern) && (owner === page || ancestors.includes(owner)))
          sources.set(pattern, extendsExisting ? pageSources : undefined)
          owners.set(pattern, page)
        }
      }
      if (page.children?.length && !collect(page.children, [...routes], pageSources, [...ancestors, page])) { return false }
    }
    return true
  }
  return collect(pages, ['/'], [], []) ? sources : undefined
}

/**
 * Collect a rou3 pattern for every path a page can be reached by: its canonical
 * path, each alias, and the whole subtree below it. Returns `undefined` when any
 * path cannot be converted, so callers can fall back to matching everything;
 * the routes that could not be converted are reported via `onUnconvertible`.
 */
export function collectRou3PagePatterns (pages: NuxtPage[], prefixes: string[] = ['/'], onUnconvertible?: (route: string) => void): string[] | undefined {
  const patterns: string[] = []
  let failed = false
  for (const page of pages) {
    const routes = resolvePageRoutes(page, prefixes)
    for (const route of routes) {
      const converted = isDecodable(route) ? vueRouterToRou3(route, { collapse: true }).patterns : []
      if (!converted.length) {
        onUnconvertible?.(route)
        failed = true
        continue
      }
      patterns.push(...converted)
    }
    if (page.children?.length) {
      const childPatterns = collectRou3PagePatterns(page.children, [...routes], onUnconvertible)
      if (childPatterns) { patterns.push(...childPatterns) } else { failed = true }
    }
  }
  return failed ? undefined : patterns
}

// convert to rou3-compatible path (https://github.com/h3js/rou3)
function toRou3Path (path: string): string {
  return path
    // remove all regex patterns
    .replace(/\([^)]*\)/g, '')
    // catchalls: `:name([^/]*)*` or `:catchall(.*)*`
    .replace(/:(\w+)\*.*/g, (_, name) => `**:${name}`)
    // dynamic paths, including custom patterns, e.g. :id([^/]*)*/suffix
    .replace(/:([^/*]*)/g, (_, name) => `:${name.replace(/\W/g, (r: string) => r === '?' ? '' : '_')}`)
}

const OPTIONAL_SEGMENT_RE = /(?<=^|\/):(\w+)(\?|\(\.\*\)\??)(?=\/|$)/g

function toRou3RoutePath (path: string): string {
  let pattern = ''
  let start = 0
  for (const match of path.matchAll(OPTIONAL_SEGMENT_RE)) {
    pattern += toRou3Path(path.slice(start, match.index))
    if (pattern.includes('**:')) { return pattern }
    pattern += match[2] === '?' ? `:${match[1]}?` : `:${match[1]}(.*)`
    start = match.index + match[0].length
  }
  return pattern + toRou3Path(path.slice(start))
}

export function toRou3Patterns (pages: NuxtPage[], prefix = '/'): string[] {
  const routes: string[] = []
  for (const page of pages) {
    const path = joinURL(prefix, toRou3Path(page.path))
    routes.push(path)
    if (page.children) {
      routes.push(...toRou3Patterns(page.children, path))
    }
  }
  return routes
}

/**
 * The rou3 pattern of every path a page can be reached by (its path, each alias and the
 * subtree below it) for `ssrRoutes`, keeping param names, whole-segment optional params
 * and non-repeatable `(.*)` catch-alls.
 */
export function toRou3RoutePatterns (pages: NuxtPage[], prefixes: string[] = ['/']): string[] {
  const patterns: string[] = []
  for (const page of pages) {
    const routes = resolvePageRoutes(page, prefixes)
    for (const route of routes) {
      patterns.push(toRou3RoutePath(route))
    }
    if (page.children) {
      patterns.push(...toRou3RoutePatterns(page.children, [...routes]))
    }
  }
  return patterns
}
