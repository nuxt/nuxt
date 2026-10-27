import type { RouteLocationGeneric } from 'vue-router'

/** An absolute path with no query, hash or percent-encoding: its `href` is the history base plus the path. */
export function isPlainAbsolutePath (to: string): boolean {
  return to[0] === '/' && !to.includes('?') && !to.includes('#') && !to.includes('%')
}

const PARAM_SEGMENT_RE = /^:\w+\(\)$/
const routePatternCache = new WeakMap<RouteLocationGeneric, string[][] | null>()

/**
 * Whether `path` might resolve to a record in `currentRoute.matched`, the precondition for a
 * link being active. Conservative: `true` unless every record's path is a plain mix of static
 * and required param segments and none can match.
 */
export function mayMatchCurrentRoute (currentRoute: RouteLocationGeneric, path: string): boolean {
  let patterns = routePatternCache.get(currentRoute)
  if (patterns === undefined) {
    patterns = []
    for (const record of currentRoute.matched) {
      if (record.aliasOf || (record as { alias?: unknown }).alias) { patterns = null; break }
      const segments = splitSegments(record.path)
      for (const segment of segments) {
        if (segment.includes(':') ? !PARAM_SEGMENT_RE.test(segment) : /[?*+()]/.test(segment)) { patterns = null; break }
      }
      if (!patterns) { break }
      patterns.push(segments)
    }
    routePatternCache.set(currentRoute, patterns)
  }
  if (!patterns) { return true }
  const target = splitSegments(path)
  outer: for (const pattern of patterns) {
    if (pattern.length !== target.length) { continue }
    for (let i = 0; i < pattern.length; i++) {
      const p = pattern[i]!
      const t = target[i]!
      if (p[0] === ':') {
        if (!t) { continue outer }
      } else if (p.toLowerCase() !== t.toLowerCase()) {
        continue outer
      }
    }
    return true
  }
  return false
}

function splitSegments (path: string): string[] {
  const segments = path.split('/')
  if (segments.length > 1 && segments[segments.length - 1] === '') { segments.pop() }
  return segments
}
