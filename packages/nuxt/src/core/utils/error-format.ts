import { isAgent } from 'std-env'

export interface ErrorMessageOptions {
  /** A documentation URL relevant to this error */
  docs?: string
  /** A concrete suggestion for how to fix the issue */
  fix?: string
  /** Extra context to include (only shown when an agent is detected) */
  context?: Record<string, unknown>
}

/**
 * Format an error message, enriching it with extra context when running inside
 * an AI coding agent (detected via `std-env`).
 *
 * In non-agent environments the `fix` is always appended (when provided) and
 * the `docs` link is appended. The `context` block is only included for agents
 * to keep human-facing output concise.
 */
export function formatErrorMessage (message: string, opts?: ErrorMessageOptions): string {
  if (!opts) { return message }

  let result = message

  if (opts.fix) {
    result += ` ${opts.fix}`
  }

  if (opts.docs) {
    result += ` See: ${opts.docs}`
  }

  if (isAgent && opts.context) {
    const entries = Object.entries(opts.context)
      .map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
    result += `\n\nDiagnostic context:\n${entries}`
  }

  return result
}
