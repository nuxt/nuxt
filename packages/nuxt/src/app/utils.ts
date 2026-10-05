import { captureStackTrace } from 'errx'
import { isScriptProtocol } from 'ufo'

const PROBE_BASE_A = 'https://a.invalid/probe/'
const PROBE_BASE_B = 'https://b.invalid/probe/'

function parseAnchorURL (value: string, base: string = PROBE_BASE_A): URL | null {
  try {
    return new URL(value, base)
  } catch {
    return null
  }
}

/** Whether a URL string is a path rooted at the current origin, so carries no protocol. */
export function isRootedPath (value: string): boolean {
  return value[0] === '/' && value[1] !== '/' && value[1] !== '\\'
}

/** Whether a URL string carries its own protocol or authority. */
export function isAbsoluteHref (value: string): boolean {
  if (!value || isRootedPath(value)) {
    return false
  }
  // a relative value inherits whichever base it resolves against; an absolute one ignores both
  const resolved = parseAnchorURL(value)
  return !!resolved && resolved.href === parseAnchorURL(value, PROBE_BASE_B)?.href
}

/** The script-capable protocol a URL string would navigate to, or `null` when it is safe. */
export function getScriptProtocol (value: string): string | null {
  if (!value || isRootedPath(value)) {
    return null
  }
  // browser URL parsers ignore whitespace and control characters around a scheme
  // eslint-disable-next-line no-control-regex
  let resolved = parseAnchorURL(value.replace(/[\u0000-\u001F\u007F\s]+/g, ''))
  // Chromium resolves `view-source:` transparently to the inner URL
  while (resolved?.protocol === 'view-source:') {
    resolved = parseAnchorURL(resolved.pathname)
  }
  if (!resolved) {
    return ''
  }
  return isScriptProtocol(resolved.protocol) ? resolved.protocol : null
}

/** Returns the value unchanged when safe to use as an anchor `href`, or `null`. */
export function sanitizeAnchorHref (value: string): string | null {
  return getScriptProtocol(value) === null ? value : null
}

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export type ArrayItems<T> = NonNullable<T> extends readonly (infer U)[] ? U : NonNullable<T>
export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never

const BOT_RE = /bot\b|chrome-lighthouse|facebookexternalhit|google\b/i

export function isBotUserAgent (userAgent: string): boolean {
  return BOT_RE.test(userAgent)
}

const distURL = import.meta.dev ? import.meta.url.replace(/\/app\/.*$/, '/') : ''
type Trace = { source: string, line?: number, column?: number }

export function getUserTrace (): Trace[] {
  if (!import.meta.dev) {
    return []
  }

  const trace = captureStackTrace()
  const start = trace.findIndex(entry => !entry.source.startsWith(distURL))
  const end = trace.findLastIndex(entry => !entry.source.includes('node_modules') && !entry.source.startsWith(distURL))
  if (start === -1 || end === -1) {
    return []
  }
  return trace.slice(start, end + 1).map(i => ({
    ...i,
    source: i.source.replace(/^file:\/\//, ''),
  }))
}

export function getUserCaller (): Trace | null {
  if (!import.meta.dev) {
    return null
  }

  const { source, line, column } = captureStackTrace().find(entry => !entry.source.startsWith(distURL)) ?? {}

  if (!source) {
    return null
  }

  return {
    source: source.replace(/^file:\/\//, ''),
    line,
    column,
  }
}
