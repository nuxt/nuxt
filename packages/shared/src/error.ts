export interface FrameConnectors {
  mid: string
  end: string
  pipe: string
  space: string
}

const defaultConnectors: FrameConnectors = {
  mid: '├▶',
  end: '╰▶',
  pipe: '│',
  space: '  ',
}

export interface WrapLineOptions {
  width?: number
  pipe?: string
  stripAnsi?: (s: string) => string
}

/**
 * Word-wrap a single detail line at a given width (default 76 chars).
 * Returns the wrapped string with continuation lines joined by `pipe`
 * (default `'\n│  '`).
 *
 * Pass `stripAnsi` to strip ANSI escape codes before measuring length
 * (needed for build-time coloured strings).
 */
export function wrapLine (text: string, opts?: WrapLineOptions): string {
  const width = opts?.width ?? 76
  const pipe = opts?.pipe ?? '\n│  '
  const measure = opts?.stripAnsi ?? ((s: string) => s)

  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (measure(test).length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) { lines.push(current) }
  return lines.join(pipe)
}

/**
 * Render an array of pre-wrapped detail strings into a box-drawing frame.
 *
 * ```
 * ├▶ first detail line that may
 * │  wrap to the next line.
 * ├▶ second detail line
 * ╰▶ last detail line
 * ```
 *
 * Pass custom `connectors` for ANSI-coloured variants.
 */
export function renderFrame (lines: string[], connectors?: FrameConnectors): string {
  const c = connectors ?? defaultConnectors
  return lines.map((line, i) => {
    const isLast = i === lines.length - 1
    const connector = isLast ? c.end : c.mid
    const wrapped = isLast
      ? line.replaceAll(`\n${c.pipe}  `, `\n${c.space} `)
      : line
    return `${connector} ${wrapped}`
  }).join('\n')
}

// --- createErrorUtils ---

export interface ErrorOptions {
  /** Error code (e.g., 'B1001'). Combined with the module prefix to form the error tag. */
  code: string
  /** Why the error occurred — the underlying reason, shown on its own line below the message */
  why?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
  /** A documentation URL (overrides code-derived URL) */
  docs?: string
  /** The underlying error that caused this one */
  cause?: unknown
  /** Extra context to include (only shown when the formatError implementation handles it) */
  context?: Record<string, unknown>
}

export interface ErrorUtilsOptions {
  /**
   * Module identifier used as the error tag prefix.
   *
   * The value is uppercased automatically.
   *
   * @example 'pinia'  // → [PINIA_001]
   * @example 'NUXT'   // → [NUXT_B1001]
   */
  module: string
  /**
   * Base URL for auto-generating docs links from error codes.
   *
   * When set, the docs URL for a given code defaults to `${docsBase}/${code}`.
   * When omitted, no docs link is shown unless `opts.docs` is provided per-call.
   */
  docsBase?: string
  /**
   * Custom error formatting function. Receives the resolved prefix, docs URL,
   * and all error options. Controls the entire rendering of the formatted message.
   *
   * Default: plain Unicode frame with `wrapLine` / `renderFrame`.
   */
  formatError?: (message: string, opts: ErrorOptions & { prefix: string, docsUrl?: string }) => string
  /** Logger for warn/error methods. Default: console. */
  logger?: { error: (...args: any[]) => void, warn: (...args: any[]) => void }
}

export interface ErrorUtils {
  /** Format an error/warning message with error code, fix, docs link, and optional diagnostic context. */
  format: (message: string, opts: ErrorOptions) => string
  /** Throw an error with an error code, fix, and context. Sets structured fields on the Error object. */
  throw: (message: string, opts: ErrorOptions) => never
  /** Log a warning with error code, fix, and context. */
  warn: (message: string, opts: ErrorOptions) => void
  /** Log an error with error code, fix, and context (without throwing). */
  error: (message: string, opts: ErrorOptions) => void
}

/**
 * Default plain-text error formatter using Unicode box-drawing frames.
 */
function defaultFormatError (message: string, opts: ErrorOptions & { prefix: string, docsUrl?: string }): string {
  const lines: string[] = []

  if (opts.why) {
    lines.push(wrapLine(opts.why))
  }

  if (opts.docsUrl) {
    lines.push(wrapLine(`see: ${opts.docsUrl}`))
  }

  if (opts.fix) {
    lines.push(wrapLine(`fix: ${opts.fix}`))
  }

  let result = `[${opts.prefix}_${opts.code}] ${message}`

  if (lines.length > 0) {
    result += '\n' + renderFrame(lines)
  }

  return result
}

/**
 * Create a set of error/warning utilities scoped to a specific module.
 *
 * The returned functions use the provided module name as the error tag prefix
 * and the provided `docsBase` for auto-generated documentation URLs.
 *
 * @example
 * ```ts
 * const errorUtils = createErrorUtils({
 *   module: 'pinia',
 *   docsBase: 'https://pinia.vuejs.org/errors',
 * })
 *
 * errorUtils.warn('Store not found.', { code: '001', fix: 'Call defineStore() first.' })
 * // Output: [PINIA_001] Store not found.
 * //         ├▶ see: https://pinia.vuejs.org/errors/001
 * //         ╰▶ fix: Call defineStore() first.
 * ```
 */
export function createErrorUtils (options: ErrorUtilsOptions): ErrorUtils {
  const prefix = options.module.toUpperCase()
  const _formatError = options.formatError ?? defaultFormatError
  const _logger = options.logger ?? console

  function resolveDocsUrl (code: string, docs?: string): string | undefined {
    return docs || (options.docsBase ? `${options.docsBase}/${code}` : undefined)
  }

  function format (message: string, opts: ErrorOptions): string {
    return _formatError(message, { ...opts, prefix, docsUrl: resolveDocsUrl(opts.code, opts.docs) })
  }

  function throwError (message: string, opts: ErrorOptions): never {
    const err = new Error(`[${prefix}_${opts.code}] ${message}`, { cause: opts.cause })
    ;(err as any).code = `${prefix}_${opts.code}`

    // Structured fields for HTML error page rendering
    if (opts.fix) { (err as any).fix = opts.fix }
    if (opts.why) { (err as any).why = opts.why }
    const docsURL = resolveDocsUrl(opts.code, opts.docs)
    if (docsURL) { (err as any).docsUrl = docsURL }

    error(message, opts)

    throw err
  }

  function warn (message: string, opts: ErrorOptions): void {
    if (opts.cause) {
      _logger.warn(format(message, opts), opts.cause)
    } else {
      _logger.warn(format(message, opts))
    }
  }

  function error (message: string, opts: ErrorOptions): void {
    if (opts.cause) {
      _logger.error(format(message, opts), opts.cause)
    } else {
      _logger.error(format(message, opts))
    }
  }

  return {
    throw: throwError,
    warn,
    error,
    format,
  }
}
