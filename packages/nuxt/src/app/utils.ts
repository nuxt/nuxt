import { captureStackTrace } from 'errx'

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

/** Escape `%` so user-controlled strings cannot inject format specifiers into `console.*` calls. */
function escapeFormatSpecifiers (str: string): string {
  return str.replaceAll('%', '%%')
}

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
/**
 * Word-wrap a single detail line for the runtime frame. Returns the
 * wrapped text with continuation lines indented under the `│` pipe.
 */
function wrapRuntimeLine (text: string, width = 76): string {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (test.length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) { lines.push(current) }
  return lines.join('\n│  ')
}

/**
 * Render an array of detail strings into a box-drawing frame.
 * Uses plain Unicode characters (no ANSI) so it works in both
 * terminal (SSR dev) and browser consoles.
 *
 * For continuation lines from word-wrap, mid-items use `│` and the
 * last item uses `   ` (spaces) since `╰` signals the frame's end.
 */
function renderRuntimeFrame (lines: string[]): string {
  return lines.map((line, i) => {
    const isLast = i === lines.length - 1
    const connector = isLast ? '╰▶' : '├▶'
    // Replace continuation pipe with correct character for wrapped lines
    const wrapped = isLast
      ? line.replaceAll('\n│  ', '\n   ')
      : line
    return `${connector} ${wrapped}`
  }).join('\n')
}

export function formatRuntimeError (message: string, opts: RuntimeErrorOptions): string {
  let result = `[NUXT_${opts.code}] ${message}`

  if (import.meta.dev) {
    const caller = getUserCaller()
    if (caller) {
      result += ` (at ${caller.source}${caller.line ? `:${caller.line}` : ''}${caller.column ? `:${caller.column}` : ''})`
    }

    const lines: string[] = []

    if (opts.why) {
      lines.push(wrapRuntimeLine(opts.why))
    }

    lines.push(wrapRuntimeLine(`see: ${DOCS_BASE}/${opts.code.toLowerCase()}`))

    if (opts.fix) {
      lines.push(wrapRuntimeLine(`fix: ${opts.fix}`))
    }

    if (lines.length > 0) {
      result += '\n' + renderRuntimeFrame(lines)
    }
  }

  // Escape `%` so user-controlled strings cannot inject format specifiers
  // into `console.*` calls (which interpret `%s`, `%d`, etc.).
  return escapeFormatSpecifiers(result)
}

/**
 * Throw an error with an error code and optional fix.
 *
 * In dev mode, logs the full frame-formatted message to the console
 * for terminal readability. Structured fields (fix, why, docs) will be stored
 * as properties on the Error object.
 */
export function throwError (message: string, opts: RuntimeErrorOptions): never {
  // Clean message for HTML display — no frame, no source location
  const err = new Error(`[NUXT_${opts.code}] ${message}`, { cause: opts.cause })
  ;(err as any).code = `NUXT_${opts.code}`

  if (import.meta.dev) {
    // Structured fields for HTML error page rendering
    if (opts.fix) { (err as any).fix = opts.fix }
    if (opts.why) { (err as any).why = opts.why }
    ;(err as any).docsUrl = `${DOCS_BASE}/${opts.code.toLowerCase()}`

    // Log the rich frame-formatted version to the console for terminal users.
    if (opts.cause) {
      console.error(formatRuntimeError(message, opts), opts.cause)
    } else {
      console.error(formatRuntimeError(message, opts))
    }
  }

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
