import { captureStackTrace } from 'errx'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

interface RuntimeErrorMessageOptions {
  /** A documentation URL relevant to this error */
  docs?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
}

/**
 * Format a runtime error message with optional fix and docs link.
 *
 * Guarded by `import.meta.dev` at the call site so the extra detail is
 * tree-shaken out of production builds.
 */
export function formatRuntimeError (message: string, opts?: RuntimeErrorMessageOptions): string {
  if (!import.meta.dev || !opts) { return message }

  let result = message

  if (opts.fix) {
    result += ` ${opts.fix}`
  }

  if (opts.docs) {
    result += ` See: ${opts.docs}`
  }

  return result
}

const distURL = import.meta.url.replace(/\/app\/.*$/, '/')
type Trace = { source: string, line?: number, column?: number }

export function getUserTrace (): Trace[] {
  if (!import.meta.dev) {
    return []
  }

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
