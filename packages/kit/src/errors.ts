import { colors } from 'consola/utils'
import { isAgent } from 'std-env'
import { logger } from './logger.ts'

const DOCS_BASE = 'https://nuxt.com/docs/errors'

export interface NuxtErrorOptions {
  /** Error code (e.g., 'E1001'). Derives docs URL. */
  code?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
  /** A documentation URL (overrides code-derived URL) */
  docs?: string
  /** Extra context to include (only shown when an AI agent is detected) */
  context?: Record<string, unknown>
}

/**
 * Format a build-time error/warning message with styling and optional
 * error code, fix, docs link, and agent-only diagnostic context.
 *
 * - The error code is always shown (bold + dim).
 * - The fix and docs link are always shown.
 * - The diagnostic context block is only shown for AI agents.
 */
export function formatBuildError (message: string, opts?: NuxtErrorOptions): string {
  if (!opts) { return message }

  const code = opts.code
  let result = message

  if (opts.fix) {
    result += ` ${opts.fix}`
  }

  const docsURL = opts.docs || (code ? `${DOCS_BASE}/${code}` : undefined)
  if (docsURL) {
    result += ` ${colors.dim('See:')} ${colors.underline(docsURL)}`
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
 * Throw a build-time error with an optional error code, fix, and agent context.
 *
 * Sets `err.code` natively on the Error object for programmatic access.
 * The error code and docs link are always included.
 */
export function throwBuildError (message: string, opts?: NuxtErrorOptions): never {
  const err = new Error(formatBuildError(message, opts))
  if (opts?.code) {
    (err as any).code = opts.code
  }
  throw err
}

/**
 * Log a build-time warning with styling, optional error code, fix, and agent context.
 *
 * Uses `logger.warn` which automatically tags output with the `nuxt` prefix.
 */
export function warnBuild (message: string, opts?: NuxtErrorOptions, ...args: unknown[]): void {
  logger.warn(formatBuildError(message, opts), ...args)
}

/**
 * Log a build-time error with styling, optional error code, fix, and agent context.
 *
 * Uses `logger.error` which automatically tags output with the `nuxt` prefix.
 */
export function errorBuild (message: string, opts?: NuxtErrorOptions, ...args: unknown[]): void {
  logger.error(formatBuildError(message, opts), ...args)
}
