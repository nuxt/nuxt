import type { RouteLocationGeneric } from 'vue-router'
import type { MatcherPatternPathDynamic, MatcherPatternPathStatic } from 'vue-router/experimental'
import { experimentalRouter } from '#build/nuxt.config.mjs'

/** An absolute path with no query, hash or percent-encoding: its `href` is the history base plus the path. */
export function isPlainAbsolutePath (to: string): boolean {
  return to[0] === '/' && !to.includes('?') && !to.includes('#') && !to.includes('%')
}

const PARAM_SEGMENT_RE = /^:\w+\(\)$/
const routePatternCache = new WeakMap<RouteLocationGeneric['matched'], string[][] | null>()

/**
 * Whether `path` might resolve to a record in `currentRoute.matched`, the precondition for a
 * link being active. Conservative: `true` unless every record's path is a plain mix of static
 * and required param segments and none can match.
 */
export function mayMatchCurrentRoute (currentRoute: RouteLocationGeneric, path: string): boolean {
  const matched = currentRoute.matched
  let patterns = routePatternCache.get(matched)
  if (patterns === undefined) {
    patterns = []
    for (const record of matched) {
      if (record.aliasOf || (record as { alias?: unknown }).alias) { patterns = null; break }
      const segments = experimentalRouter ? matcherSegments(record.path as unknown as MatcherPatternPathStatic | MatcherPatternPathDynamic<Record<string, unknown>>) : splitSegments(record.path)
      if (!segments) { patterns = null; break }
      for (const segment of segments) {
        if (segment.includes(':') ? !PARAM_SEGMENT_RE.test(segment) : /[?*+()]/.test(segment)) { patterns = null; break }
      }
      if (!patterns) { break }
      patterns.push(segments)
    }
    routePatternCache.set(matched, patterns)
  }
  if (!patterns) { return true }
  const count = countSegments(path)
  let target: string[] | undefined
  outer: for (const pattern of patterns) {
    if (pattern.length !== count) { continue }
    target ??= splitSegments(path)
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

/**
 * The segments of a path matcher of the experimental router, as `splitSegments` returns them for
 * the classic path, or `undefined` for a param that is optional, repeatable or shares its segment.
 */
function matcherSegments (matcher: MatcherPatternPathStatic | MatcherPatternPathDynamic<Record<string, unknown>>): string[] | undefined {
  if (!('pathParts' in matcher)) { return splitSegments(matcher.path) }
  const names = Object.keys(matcher.params)
  const segments: string[] = ['']
  let index = 0
  for (const part of matcher.pathParts) {
    if (typeof part === 'string') { segments.push(part); continue }
    if (Array.isArray(part)) { return }
    const [, repeatable, optional] = matcher.params[names[index++]!]!
    if (repeatable || optional) { return }
    segments.push(':_()')
  }
  return segments
}

/** The number of segments `splitSegments` returns for `path`. */
function countSegments (path: string): number {
  let count = 1
  for (let i = path.indexOf('/'); i !== -1; i = path.indexOf('/', i + 1)) { count++ }
  return count > 1 && path.endsWith('/') ? count - 1 : count
}

function splitSegments (path: string): string[] {
  const segments = path.split('/')
  if (segments.length > 1 && segments[segments.length - 1] === '') { segments.pop() }
  return segments
}
