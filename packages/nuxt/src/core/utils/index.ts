export { getNameFromPath, hasSuffix, resolveComponentNameSegments } from './names.ts'
export { JS_ID_RE, VUE_ID_FILTER, VUE_NON_SCRIPT_BLOCK_RE, VUE_SCRIPT_ID_FILTER, VUE_SCRIPT_TEMPLATE_ID_FILTER, VUE_TEMPLATE_ID_FILTER, getLoader, isJS, isVue, parseModuleId } from './plugins.ts'

export function uniqueBy<T, K extends keyof T> (arr: T[], key: K) {
  if (arr.length < 2) {
    return arr
  }
  const res: T[] = []
  const seen = new Set<T[K]>()
  for (const item of arr) {
    if (seen.has(item[key])) { continue }
    seen.add(item[key])
    res.push(item)
  }
  return res
}

export const QUOTE_RE = /["']/g
export const EXTENSION_RE = /\b\.\w+$/g
export const SX_RE = /\.[tj]sx$/

/**
 * Decode a route path for route-rule matching, returning it unchanged if it is not
 * percent-encoded or cannot be decoded. Reserved characters (`%2F`, `%3F`, …) are
 * left encoded, so decoding cannot introduce additional path segments. Only the path
 * portion is decoded; a query string, if present, is left untouched to avoid
 * double-decoding it.
 */
export function decodeRoutePath (path: string) {
  if (!path.includes('%')) { return path }
  const queryIndex = path.indexOf('?')
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex)
  try {
    return queryIndex === -1 ? decodeURI(pathname) : decodeURI(pathname) + path.slice(queryIndex)
  } catch {
    return path
  }
}

/**
 * Case-fold a decoded route path so that two paths fold to the same text exactly when a
 * case-insensitive vue-router route (a regex with the `i` flag but not `u`) treats them as
 * equal: each UTF-16 code unit is folded to the lower-case form of its upper-case form.
 */
export function foldRouteCase (path: string) {
  return path.replace(/[A-Z]+|[^\0-\x7F]/g, (char) => {
    if (char.charCodeAt(0) < 0x80) { return char.toLowerCase() }
    const upper = char.toUpperCase()
    if (upper.length !== 1 || upper.charCodeAt(0) < 0x80) { return char }
    const lower = upper.toLowerCase()
    return lower.length === 1 && lower.toUpperCase() === upper ? lower : upper
  })
}

/**
 * Resolve the `.` and `..` segments of a route path, including their percent-encoded
 * spellings (`%2e`), as a URL parser does. Only the path portion is resolved; a query
 * string, if present, is left untouched.
 */
export function resolveRoutePathDotSegments (path: string) {
  const queryIndex = path.indexOf('?')
  const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex)
  if (!/(?:^|\/)(?:\.|%2e)/i.test(pathname)) { return path }
  const input = pathname.split('/')
  const output: string[] = []
  const root = pathname.startsWith('/') ? 1 : 0
  for (const [i, segment] of input.entries()) {
    const dots = /^(?:\.|%2e)(\.|%2e)?$/i.exec(segment)
    if (!dots) {
      output.push(segment)
      continue
    }
    if (dots[1] && output.length > root) {
      output.pop()
    }
    if (i === input.length - 1) {
      output.push('')
    }
  }
  const resolved = output.join('/')
  return queryIndex === -1 ? resolved : resolved + path.slice(queryIndex)
}
