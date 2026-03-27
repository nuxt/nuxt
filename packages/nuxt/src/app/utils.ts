import { captureStackTrace } from 'errx'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export interface RuntimeErrorOptions {
  /** Error code (e.g., 'E1001'). Derives docs URL and is always shown, even in production. Displayed with NUXT_ prefix. */
  code: string
  /** A concrete suggestion for how to fix the issue (dev only) */
  fix?: string
  /** The underlying error that caused this one */
  cause?: unknown
}

const DOCS_BASE = 'https://nuxt.com/docs/errors'
const distURL = import.meta.url.replace(/\/app\/.*$/, '/')

type Trace = { source: string, line?: number, column?: number }

/**
 * Format a runtime error/warning message.
 *
 * - Always prepends `[nuxt]` and the error code (if provided).
 * - In dev, appends `fix`, the user's source location (via `errx`), and a
 *   docs link derived from the code. All dev-only code is guarded by
 *   `import.meta.dev` and tree-shaken out of production builds.
 * - In prod, only the code and core message are kept.
 */
export function formatRuntimeError (message: string, opts: RuntimeErrorOptions): string {
  let result = `[NUXT_${opts.code}] ${message}`

  if (import.meta.dev) {
    if (opts.fix) {
      result += ` ${opts.fix}`
    }
    const caller = getUserCaller()
    if (caller) {
      result += ` (at ${caller.source}${caller.line ? `:${caller.line}` : ''}${caller.column ? `:${caller.column}` : ''})`
    }
    result += ` See: ${DOCS_BASE}/${opts.code}`
  }

  return result
}

/**
 * Throw an error with an error code and optional fix.
 *
 * In dev mode, automatically appends the caller's file/line (via `errx`)
 * and a docs link derived from the error code. In production, only the
 * code and core message are kept — everything else is tree-shaken.
 */
export function throwError (message: string, opts: RuntimeErrorOptions): never {
  const err = new Error(formatRuntimeError(message, opts), { cause: opts.cause })
  ;(err as any).code = `NUXT_${opts.code}`
  throw err
}

/**
 * Log a warning with an error code and optional fix.
 *
 * In dev mode, automatically appends the caller's file/line (via `errx`)
 * and a docs link derived from the error code. In production, only the
 * code and core message are kept — everything else is tree-shaken.
 */
export function runtimeWarn (message: string, opts: RuntimeErrorOptions): void {
  if (opts.cause) {
    console.warn(formatRuntimeError(message, opts), opts.cause)
  } else {
    console.warn(formatRuntimeError(message, opts))
  }
}

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
