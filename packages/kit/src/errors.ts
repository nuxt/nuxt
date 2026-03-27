import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { logger } from './logger.ts'

const DOCS_BASE = 'https://nuxt.com/docs/e'

export interface NuxtErrorOptions {
  /** Error code (e.g., 'B1001'). Derives docs URL and is displayed with NUXT_ prefix. */
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

/**
 * Format a build-time error/warning message with error code, fix,
 * docs link, and agent-only diagnostic context.
 *
 * - Prepends `[NUXT_{code}]` tag. The `[nuxt]` prefix is omitted when
 *   a code is present (the `NUXT_` prefix already namespaces it).
 * - The fix and docs link are always shown.
 * - The diagnostic context block is only shown for AI agents.
 */
export function formatBuildError (message: string, opts: NuxtErrorOptions): string {
  let result = `[NUXT_${opts.code}] ${message}`

  if (opts.fix) {
    result += `\n  ${colors.cyan('Fix:')} ${opts.fix}`
  }

  const docsURL = opts.docs || `${DOCS_BASE}/${opts.code}`
  result += `\n  ${colors.dim('See:')} ${colors.underline(docsURL)}`

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
export function throwBuildError (message: string, opts: NuxtErrorOptions): never {
  const err = new Error(formatBuildError(message, opts), { cause: opts.cause })
  ;(err as any).code = `NUXT_${opts.code}`
  throw err
}

/**
 * Log a build-time warning with error code, fix, and agent context.
 */
export function warnBuild (message: string, opts: NuxtErrorOptions): void {
  if (opts.cause) {
    logger.warn(formatBuildError(message, opts), opts.cause)
  } else {
    logger.warn(formatBuildError(message, opts))
  }
}

/**
 * Log a build-time error with error code, fix, and agent context.
 */
export function errorBuild (message: string, opts: NuxtErrorOptions): void {
  if (opts.cause) {
    logger.error(formatBuildError(message, opts), opts.cause)
  } else {
    logger.error(formatBuildError(message, opts))
  }
}
