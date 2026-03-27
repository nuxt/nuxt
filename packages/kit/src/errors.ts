import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { logger } from './logger.ts'

export interface NuxtErrorOptions {
  /** Error code (e.g., 'B1001'). Combined with the module prefix to form the error tag. */
  code: string
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
 * //           Fix: Call defineStore() first.
 * //           See: https://pinia.vuejs.org/errors/001
 * ```
 */
export function createBuildErrorUtils (options: BuildErrorUtilsOptions) {
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
    let result = `[${prefix}_${opts.code}] ${message}`

    if (opts.fix) {
      result += `\n  ${colors.cyan('Fix:')} ${opts.fix}`
    }

    const docsURL = opts.docs || (options.docsBase ? `${options.docsBase}/${opts.code}` : undefined)
    if (docsURL) {
      result += `\n  ${colors.dim('See:')} ${colors.underline(docsURL)}`
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
    const err = new Error(formatBuildError(message, opts), { cause: opts.cause })
    ;(err as any).code = `${prefix}_${opts.code}`
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
