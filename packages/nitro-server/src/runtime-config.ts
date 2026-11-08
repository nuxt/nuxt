import type { Nuxt } from '@nuxt/schema'
import { getRuntimeConfigSchema } from '@nuxt/kit/internal'
import type { Nitro } from 'nitro/types'

import { nitroBuildDiagnostics } from './diagnostics.ts'

export const RUNTIME_CONFIG_SCHEMA_ID = '#internal/nuxt/runtime-config-schema'
const NITRO_RUNTIME_CONFIG_ID = '#nitro/virtual/runtime-config'

const USE_RUNTIME_CONFIG_EXPORT_RE = /\bexport\s*\{[^}]*\buseRuntimeConfig\b[^}]*\}|\bexport\s+(?:async\s+)?(?:function\*?|const|let|var)\s+useRuntimeConfig\b/

/**
 * The schema the server applies environment variables to the runtime config with.
 */
export function getRuntimeConfigSchemaModule (nuxt: Nuxt, nitro: Nitro): string {
  const schema = getRuntimeConfigSchema(nitro.options.runtimeConfig as Record<string, unknown>, nuxt.options._runtimeConfigSchemas)
  return `export default ${JSON.stringify(schema)}`
}

/**
 * Replace every module that implements `useRuntimeConfig` on nitro's serialised runtime config
 * with a re-export of `runtimeConfigPath`, so that environment variables are applied once,
 * and every reader of the runtime config receives the same values.
 *
 * With `strict`, the build fails if no module was replaced.
 */
export function runtimeConfigPlugin (runtimeConfigPath: string, { strict = false } = {}) {
  const isOwnModule = (id: string) => id.startsWith(runtimeConfigPath)
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
    resolveId: {
      filter: { id: /^#nitro\/virtual\/runtime-config$/ },
      async handler (this: PluginContext, id: string, importer: string | undefined, options: Record<string, unknown>) {
        if (!importer || !isOwnModule(importer)) {
          return
        }
        const resolved = await this.resolve(id, importer, { ...options, skipSelf: true })
        if (!resolved) {
          throw nitroBuildDiagnostics.NUXT_B9012({ id })
        }
        return resolved
      },
    },
    transform: {
      filter: { code: NITRO_RUNTIME_CONFIG_ID },
      handler (code: string, id: string) {
        if (isOwnModule(id) || id.includes(NITRO_RUNTIME_CONFIG_ID) || !USE_RUNTIME_CONFIG_EXPORT_RE.test(code)) {
          return
        }
        replaced = true
        return { code: `export { useRuntimeConfig } from ${JSON.stringify(runtimeConfigPath)}`, map: null }
      },
    },
  }
}

interface PluginContext {
  resolve: (id: string, importer?: string, options?: Record<string, unknown>) => Promise<{ id: string } | null>
}
