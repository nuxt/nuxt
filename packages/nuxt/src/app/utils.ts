import { captureStackTrace } from 'errx'
import { createErrorUtils } from '../../../shared/src/error.ts'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export interface RuntimeErrorOptions {
  /** Error code (e.g., 'E1001'). Derives docs URL and is always shown, even in production. Displayed with NUXT_ prefix. */
  code: string
  /** Why the error occurred — the underlying reason, shown on its own line below the message (dev only) */
  why?: string
  /** A concrete suggestion for how to fix the issue (dev only) */
  fix?: string
  /** The underlying error that caused this one */
  cause?: unknown
  /** Extra context to include (only shown in dev when an AI agent is detected) */
  context?: Record<string, unknown>
}

const DOCS_BASE = 'https://nuxt.com/docs/e'

const distURL = import.meta.url.replace(/\/app\/.*$/, '/')

type Trace = { source: string, line?: number, column?: number }

export const runtimeErrorUtils = /* @__PURE__ */ createErrorUtils({
  prefix: 'NUXT',
  docsBase: DOCS_BASE,
  // TODO: implement the formatter and logger to forward them to the server side
})

export function getUserTrace (): Trace[] {
  if (!import.meta.dev) { return [] }

  const trace = captureStackTrace()
  const start = trace.findIndex(entry => !entry.source.startsWith(distURL))
  const end = [...trace].reverse().findIndex(entry => !entry.source.includes('node_modules') && !entry.source.startsWith(distURL))
  if (start === -1 || end === -1) {
    return []
  }
  return trace.slice(start, end > 0 ? -end : undefined).map(i => ({
    ...i,
    source: i.source.replace(/^file:\/\//, ''),
  }))
}

export function getUserCaller (): Trace | null {
  if (!import.meta.dev) { return null }

  const { source, line, column } = captureStackTrace().find(entry => !entry.source.startsWith(distURL)) ?? {}
  if (!source) { return null }
  return { source: source.replace(/^file:\/\//, ''), line, column }
}
