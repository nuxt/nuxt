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

export interface ErrorInfo {
  /** The error tag prefix */
  codePrefix?: string
  /** Error code (e.g., 'B1001'). Combined with the module prefix to form the error tag. */
  code: string
  /** The error message */
  message: string
  /** Why the error occurred — the underlying reason, shown on its own line below the message */
  why?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
  /** A hint to the user about the error */
  hint?: string
  /** A documentation URL (overrides code-derived URL) */
  docs?: string
  /** The location of source file that caused the error */
  source?: {
    file: string
    line?: number
    column?: number
  }
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
   * @example 'PINIA'  // → [PINIA_001]
   * @example 'NUXT'   // → [NUXT_B1001]
   */
  prefix: string
  /**
   * Base URL for auto-generating docs links from error codes.
   *
   * When set, the docs URL for a given code defaults to `${docsBase}/${code}`.
   * When omitted, no docs link is shown unless `opts.docs` is provided per-call.
   */
  docsBase?: string | ((code?: string) => string | undefined)
  /**
   * Custom error formatting function. Receives the resolved prefix, docs URL,
   * and all error info. Controls the entire rendering of the formatted message.
   *
   * Default: plain Unicode frame with `wrapLine` / `renderFrame`.
   */
  formatError?: (item: ErrorInfo, options: ErrorUtilsOptions) => string
  /**
   * Called after formatting, before logging. Use to forward errors
   * to an external system (e.g., POST to a dev server).
   *
   * Default: logs the formatted message via `console.warn` / `console.error`.
   */
  reporter?: (item: ErrorInfo, level: 'warn' | 'error', formatted: string) => void
}

export interface ErrorUtils {
  /** Format an error/warning message with error code, fix, docs link, and optional diagnostic context. */
  format: (item: ErrorInfo) => string
  /** Throw an error with an error code, fix, and context. Sets structured fields on the Error object. */
  throw: (item: ErrorInfo) => never
  /** Log a warning with error code, fix, and context. */
  warn: (item: ErrorInfo) => void
  /** Log an error with error code, fix, and context (without throwing). */
  error: (item: ErrorInfo) => void
}

/**
 * Default plain-text error formatter using Unicode box-drawing frames.
 */
function defaultFormatError (item: ErrorInfo, options: ErrorUtilsOptions): string {
  const lines: string[] = []

  if (item.why) {
    lines.push(wrapLine(`why: ${item.why}`))
  }

  const docs = resolveDocsUrl(item.code, options.docsBase)
  if (docs) {
    lines.push(wrapLine(`see: ${docs}`))
  }
  if (item.fix) {
    lines.push(wrapLine(`fix: ${item.fix}`))
  }
  if (item.hint) {
    lines.push(wrapLine(`hint: ${item.hint}`))
  }
  if (item.source) {
    lines.push(wrapLine(`source: ${item.source.file}:${item.source.line}:${item.source.column}`))
  }

  let result = `[${resolveCode(item.code, item.codePrefix ?? options.prefix)}] ${item.message}`

  if (lines.length > 0) {
    result += '\n' + renderFrame(lines)
  }

  return result
}

function resolveDocsUrl (code: string, docsBase: ErrorUtilsOptions['docsBase']): string | undefined {
  return typeof docsBase === 'function'
    ? docsBase(code)
    : docsBase
      ? `${docsBase}/${code}`
      : undefined
}

function resolveCode (code: string, codePrefix: string | undefined): string {
  return codePrefix ? `${codePrefix}_${code}` : code
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
 *   prefix: 'pinia',
 *   docsBase: 'https://pinia.vuejs.org/errors',
 * })
 *
 * errorUtils.warn({ message: 'Store not found.', code: '001', fix: 'Call defineStore() first.' })
 * // Output: [PINIA_001] Store not found.
 * //         ├▶ see: https://pinia.vuejs.org/errors/001
 * //         ╰▶ fix: Call defineStore() first.
 * ```
 */
function defaultReporter (item: ErrorInfo, level: 'warn' | 'error', formatted: string): void {
  if (item.cause) {
    console[level](formatted, item.cause)
  } else {
    console[level](formatted)
  }
}

export function createErrorUtils (options: ErrorUtilsOptions): ErrorUtils {
  const _formatError = options.formatError ?? defaultFormatError
  const _reporter = options.reporter ?? defaultReporter

  function format (item: ErrorInfo): string {
    return _formatError(item, options)
  }

  function throwError (item: ErrorInfo): never {
    const code = resolveCode(item.code, item.codePrefix ?? options.prefix)
    const err = new Error(`[${code}] ${item.message}`, { cause: item.cause })
    ;(err as any).code = code

    // Structured fields for HTML error page rendering
    if (item.fix) { (err as any).fix = item.fix }
    if (item.why) { (err as any).why = item.why }
    if (item.hint) { (err as any).hint = item.hint }
    if (item.source) { (err as any).source = item.source }
    const docsUrl = item.docs || resolveDocsUrl(item.code, options.docsBase)
    if (docsUrl) { (err as any).docsUrl = docsUrl }

    error(item)

    throw err
  }

  function warn (item: ErrorInfo): void {
    _reporter(item, 'warn', format(item))
  }

  function error (item: ErrorInfo): void {
    _reporter(item, 'error', format(item))
  }

  return {
    throw: throwError,
    warn,
    error,
    format,
  }
}
