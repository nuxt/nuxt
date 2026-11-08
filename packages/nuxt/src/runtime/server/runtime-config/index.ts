import type { RuntimeConfigSchemaObject } from '@nuxt/schema/internal'
import { applyRuntimeConfigSchema, formatRuntimeConfigIssues } from './schema'
import type { RuntimeConfigIssue } from './schema'
import { runtimeConfigDiagnostics } from './diagnostics'
import { guardMissingRuntimeConfig } from './prerender'

/**
 * Create a `useRuntimeConfig` for a server builder from its serialised runtime config. The
 * first call applies environment variables to `config` in place, according to `schema`.
 *
 * Invalid values throw. Missing required values throw too, except while prerendering, when
 * reading a missing value throws instead. With `strictPaths`, only values at or below one
 * of those paths throw, and the rest only warn.
 */
export function createRuntimeConfig<T extends Record<string, any>> (config: T, schema: RuntimeConfigSchemaObject, strictPaths?: string[]): () => T {
  let applied = false
  let error: Error | undefined
  return () => {
    if (error) {
      throw error
    }
    if (applied) {
      return config
    }
    const env = globalThis.process?.env ?? {}
    const { fatal, lenient } = partitionRuntimeConfigIssues(applyRuntimeConfigSchema(config, schema, {
      env,
      prefix: 'NITRO_',
      altPrefix: config.nitro?.envPrefix ?? env.NITRO_ENV_PREFIX ?? 'NUXT_',
      envExpansion: Boolean(config.nitro?.envExpansion ?? env.NITRO_ENV_EXPANSION ?? false),
    }), strictPaths)
    applied = true
    warnRuntimeConfigIssues(lenient)
    try {
      return config = checkRuntimeConfigIssues(config, schema, fatal)
    } catch (cause) {
      throw error = cause as Error
    }
  }
}

/**
 * Split `issues` into those that stop the server and those that only warn. Without
 * `strictPaths`, every issue stops the server; otherwise only the issues of values at or
 * below one of `strictPaths` do.
 */
export function partitionRuntimeConfigIssues (issues: RuntimeConfigIssue[], strictPaths?: string[]): { fatal: RuntimeConfigIssue[], lenient: RuntimeConfigIssue[] } {
  if (!strictPaths) {
    return { fatal: issues, lenient: [] }
  }
  const fatal: RuntimeConfigIssue[] = []
  const lenient: RuntimeConfigIssue[] = []
  for (const issue of issues) {
    const isStrict = strictPaths.some(path => !path || issue.path === path || issue.path.startsWith(`${path}.`))
    ;(isStrict ? fatal : lenient).push(issue)
  }
  return { fatal, lenient }
}

/** Report issues that do not stop the server. */
export function warnRuntimeConfigIssues (issues: RuntimeConfigIssue[]): void {
  if (!issues.length) {
    return
  }
  const formatted = formatRuntimeConfigIssues(issues)
  if (import.meta.dev || import.meta.prerender) {
    runtimeConfigDiagnostics.NUXT_E8014({ issues: formatted }, { method: 'warn' })
  } else {
    console.warn(`[NUXT_E8014] The runtime config does not match its schema:\n  - ${formatted}\n\nSee https://nuxt.com/docs/4.x/errors/e8014`)
  }
}

/**
 * Throw for issues that stop the server. While prerendering, missing values only throw
 * when they are read, so `config` is returned guarded.
 */
export function checkRuntimeConfigIssues<T extends Record<string, any>> (config: T, schema: RuntimeConfigSchemaObject, issues: RuntimeConfigIssue[]): T {
  if (!issues.length) {
    return config
  }
  if (import.meta.prerender && !issues.some(issue => 'received' in issue)) {
    return guardMissingRuntimeConfig(config, schema, issues)
  }
  const formatted = formatRuntimeConfigIssues(issues)
  if (import.meta.dev || import.meta.prerender) {
    throw runtimeConfigDiagnostics.NUXT_E8014({ issues: formatted })
  }
  throw new Error(`[NUXT_E8014] The runtime config does not match its schema:\n  - ${formatted}\n\nSee https://nuxt.com/docs/4.x/errors/e8014`)
}
