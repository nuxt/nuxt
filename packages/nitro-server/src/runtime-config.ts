import type { Nuxt } from '@nuxt/schema'
import { getRuntimeConfigSchema } from '@nuxt/kit/internal'
import type { Nitro } from 'nitropack/types'

import { nitroBuildDiagnostics } from './diagnostics.ts'

export const RUNTIME_CONFIG_SCHEMA_ID = '#internal/nuxt/runtime-config-schema'

const NITRO_CONFIG_MODULE_RE = /[\\/]nitropack(?:-nightly)?[\\/]dist[\\/]runtime[\\/]internal[\\/]config\.mjs$/
const USE_RUNTIME_CONFIG_EXPORT_RE = /\bexport\s+function\s+useRuntimeConfig\b/

/**
 * Whether the server applies environment variables through a runtime config schema: when a
 * schema is declared, or with `compatibilityVersion: 5`, where every value is typed by its
 * default. Otherwise nitro's own `useRuntimeConfig` is left as it is.
 */
export function usesRuntimeConfigSchema (nuxt: Nuxt): boolean {
  return inferRuntimeConfigSchema(nuxt) || !!nuxt.options._runtimeConfigSchemas?.length
}

function inferRuntimeConfigSchema (nuxt: Nuxt): boolean {
  return (nuxt.options.future?.compatibilityVersion ?? 4) >= 5
}

/**
 * The schema the server applies environment variables to the runtime config with. Before
 * `compatibilityVersion: 5`, `strictPaths` lists the schemas declared in `nuxt.config`:
 * only their issues stop the server, while issues with schemas from modules only warn.
 */
export function getRuntimeConfigSchemaModule (nuxt: Nuxt, nitro: Nitro): string {
  const infer = inferRuntimeConfigSchema(nuxt)
  const schema = getRuntimeConfigSchema(nitro.options.runtimeConfig as Record<string, unknown>, nuxt.options._runtimeConfigSchemas, { infer })
  const strictPaths = infer ? undefined : (nuxt.options._runtimeConfigSchemas ?? []).filter(entry => !entry.module).map(entry => entry.path.join('.'))
  return `export default ${JSON.stringify(schema)}\nexport const strictPaths = ${JSON.stringify(strictPaths) ?? 'undefined'}`
}

/**
 * Replace nitro's runtime config module with a re-export of `runtimeConfigPath`, so that
 * environment variables are applied through the runtime config schema.
 *
 * With `strict`, the build fails if nitro's module was not replaced.
 */
export function runtimeConfigPlugin (runtimeConfigPath: string, { strict = false } = {}) {
  let replaced = false
  return {
    name: 'nuxt:runtime-config',
    buildStart () {
      replaced = false
    },
    buildEnd (error?: Error) {
      if (strict && !error && !replaced) {
        throw nitroBuildDiagnostics.NUXT_B9012({ id: 'useRuntimeConfig' })
      }
    },
    transform: {
      filter: { id: NITRO_CONFIG_MODULE_RE },
      handler (code: string) {
        if (!USE_RUNTIME_CONFIG_EXPORT_RE.test(code)) {
          return
        }
        replaced = true
        const specifier = JSON.stringify(runtimeConfigPath)
        return { code: `export * from ${specifier}\nexport { default } from ${specifier}`, map: null }
      },
    },
  }
}
