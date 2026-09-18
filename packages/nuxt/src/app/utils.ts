import { captureStackTrace } from 'errx'
import { isScriptProtocol } from 'ufo'

/** Returns the value unchanged when safe to use as an anchor `href`, or `null`. */
export function sanitizeAnchorHref (value: string): string | null {
  // browser URL parsers ignore whitespace and control characters around a scheme
  // eslint-disable-next-line no-control-regex
  let candidate = value.replace(/[\u0000-\u001F\s]+/g, '')
  // Chromium resolves `view-source:` transparently to the inner URL
  while (candidate.toLowerCase().startsWith('view-source:')) {
    candidate = candidate.slice('view-source:'.length)
  }
  const colon = candidate.indexOf(':')
  if (colon > 0 && isScriptProtocol(candidate.slice(0, colon + 1))) {
    return null
  }
  return value
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
