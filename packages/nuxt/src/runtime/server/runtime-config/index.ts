import type { RuntimeConfigSchemaObject } from '@nuxt/schema/internal'
import { applyRuntimeConfigSchema, formatRuntimeConfigIssues } from './schema'
import { prerenderDiagnostics, runtimeConfigDiagnostics } from './diagnostics'

/**
 * Create a `useRuntimeConfig` for a server builder from its serialised runtime config. The
 * first call applies environment variables to `config` in place, according to `schema`.
 *
 * Invalid values throw. Missing required values throw too, except while prerendering.
 */
export function createRuntimeConfig<T extends Record<string, any>> (config: T, schema: RuntimeConfigSchemaObject): () => T {
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
    const issues = applyRuntimeConfigSchema(config, schema, {
      env,
      prefix: 'NITRO_',
      altPrefix: config.nitro?.envPrefix ?? env.NITRO_ENV_PREFIX ?? 'NUXT_',
      envExpansion: Boolean(config.nitro?.envExpansion ?? env.NITRO_ENV_EXPANSION ?? false),
    })
    applied = true
    if (issues.length) {
      const formatted = formatRuntimeConfigIssues(issues)
      if (import.meta.prerender && !issues.some(issue => 'received' in issue)) {
        prerenderDiagnostics.NUXT_E8015({ issues: formatted })
      } else if (import.meta.dev || import.meta.prerender) {
        throw error = runtimeConfigDiagnostics.NUXT_E8014({ issues: formatted })
      } else {
        throw error = new Error(`[NUXT_E8014] The runtime config does not match its schema:\n  - ${formatted}\n\nSee https://nuxt.com/docs/5.x/errors/e8014`)
      }
    }
    return config
  }
}
