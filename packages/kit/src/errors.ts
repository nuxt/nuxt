import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { logger } from './logger.ts'

const CONNECTOR_MID = colors.dim('├▶')
const CONNECTOR_END = colors.dim('╰▶')
const PIPE = colors.dim('│')

/**
 * Word-wrap a single detail line at ~76 chars (to stay under 80 with the
 * `│  ` prefix). Returns the wrapped string with continuation lines
 * indented to align with the first line's content (after the connector).
 */
function wrapFrameLine (text: string, width = 76): string {
  // Strip ANSI for length calculations
  // eslint-disable-next-line no-control-regex
  const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '')

  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (stripAnsi(test).length > width && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) { lines.push(current) }
  return lines.join(`\n${PIPE}  `)
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
 */
function renderFrame (lines: string[]): string {
  const SPACE_PAD = colors.dim('  ')
  return lines.map((line, i) => {
    const isLast = i === lines.length - 1
    const connector = isLast ? CONNECTOR_END : CONNECTOR_MID
    // For the last item, replace pipe continuations with spaces since
    // `╰` signals the frame's end
    const wrapped = isLast
      ? line.replaceAll(`\n${PIPE}  `, `\n${SPACE_PAD} `)
      : line
    return `${connector} ${wrapped}`
  }).join('\n')
}

export interface NuxtErrorOptions {
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
  /** Extra context to include (only shown when an AI agent is detected) */
  context?: Record<string, unknown>
}

export interface BuildErrorUtilsOptions {
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
}

export interface BuildErrorUtils {
  /** Format a build-time error/warning message with error code, fix, docs link, and agent-only diagnostic context. */
  formatBuildError: (message: string, opts: NuxtErrorOptions) => string
  /** Throw a build-time error with an error code, fix, and agent context. Sets `err.code` on the Error object. */
  throwBuildError: (message: string, opts: NuxtErrorOptions) => never
  /** Log a build-time warning with error code, fix, and agent context. */
  warnBuild: (message: string, opts: NuxtErrorOptions) => void
  /** Log a build-time error with error code, fix, and agent context (without throwing). */
  errorBuild: (message: string, opts: NuxtErrorOptions) => void
}

/**
 * Create a set of build-time error/warning utilities scoped to a specific
 * module. The returned functions use the provided module name as the error
 * tag prefix and the provided `docsBase` for auto-generated documentation
 * URLs.
 *
 * @example
 * ```ts
 * import { createBuildErrorUtils } from '@nuxt/kit'
 *
 * const { warnBuild, throwBuildError } = createBuildErrorUtils({
 *   module: 'pinia',
 *   docsBase: 'https://pinia.vuejs.org/errors',
 * })
 *
 * warnBuild('Store not found.', { code: '001', fix: 'Call defineStore() first.' })
 * // Output: [PINIA_001] Store not found.
 * //         ├▶ see: https://pinia.vuejs.org/errors/001
 * //         ╰▶ fix: Call defineStore() first.
 * ```
 */
export function createBuildErrorUtils (options: BuildErrorUtilsOptions): BuildErrorUtils {
  const prefix = options.module.toUpperCase()

  /**
   * Format a build-time error/warning message with error code, fix,
   * docs link, and agent-only diagnostic context.
   *
   * - Prepends `[{PREFIX}_{code}]` tag.
   * - The fix and docs link are always shown when available.
   * - The diagnostic context block is only shown for AI agents.
   */
  function formatBuildError (message: string, opts: NuxtErrorOptions): string {
    // Build the detail lines that go inside the frame
    const lines: string[] = []

    if (opts.why) {
      lines.push(wrapFrameLine(opts.why))
    }

    const docsURL = opts.docs || (options.docsBase ? `${options.docsBase}/${opts.code}` : undefined)
    if (docsURL) {
      lines.push(wrapFrameLine(`${colors.bold('see:')} ${colors.underline(docsURL)}`))
    }

    if (opts.fix) {
      lines.push(wrapFrameLine(`${colors.bold('fix:')} ${opts.fix}`))
    }

    // Header line with error code and message
    let result = `${colors.bold(`[${prefix}_${opts.code}]`)} ${message}`

    // Render the frame if there are detail lines
    if (lines.length > 0) {
      result += '\n' + renderFrame(lines)
    }

    if (isAgent && opts.context) {
      const entries = Object.entries(opts.context)
        .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join('\n')
      result += `\n\nDiagnostic context:\n${entries}`
    }

    return result
  }

  /**
   * Throw a build-time error with an error code, fix, and agent context.
   *
   * Sets `err.code` on the Error object for programmatic access.
   */
  function throwBuildError (message: string, opts: NuxtErrorOptions): never {
    const err = new Error(`[${prefix}_${opts.code}] ${message}`, { cause: opts.cause })
    ;(err as any).code = `${prefix}_${opts.code}`

    // Structured fields for HTML error page rendering
    if (opts.fix) { (err as any).fix = opts.fix }
    if (opts.why) { (err as any).why = opts.why }
    const docsURL = opts.docs || (options.docsBase ? `${options.docsBase}/${opts.code}` : undefined)
    if (docsURL) { (err as any).docsUrl = docsURL }

    // Log the rich frame-formatted version to the console for terminal users
    if (opts.cause) {
      logger.error(formatBuildError(message, opts), opts.cause)
    } else {
      logger.error(formatBuildError(message, opts))
    }

    throw err
  }

  /**
   * Log a build-time warning with error code, fix, and agent context.
   */
  function warnBuild (message: string, opts: NuxtErrorOptions): void {
    if (opts.cause) {
      logger.warn(formatBuildError(message, opts), opts.cause)
    } else {
      logger.warn(formatBuildError(message, opts))
    }
  }

  /**
   * Log a build-time error with error code, fix, and agent context.
   */
  function errorBuild (message: string, opts: NuxtErrorOptions): void {
    if (opts.cause) {
      logger.error(formatBuildError(message, opts), opts.cause)
    } else {
      logger.error(formatBuildError(message, opts))
    }
  }

  return { formatBuildError, throwBuildError, warnBuild, errorBuild }
}
