import type { Nuxt } from '@nuxt/schema'
import { getRuntimeConfigSchema } from '@nuxt/kit/internal'
import type { Plugin } from 'vite'

export const RUNTIME_CONFIG_ID = 'virtual:nuxt-vite-server/runtime-config'
const RESOLVED_RUNTIME_CONFIG_ID = '\0' + RUNTIME_CONFIG_ID

/**
 * Provides the `useRuntimeConfig` of each environment. On the server, environment variables are
 * applied to the whole runtime config according to its schema. Other environments only receive
 * `app` and `public`, serialised at build time.
 */
export function RuntimeConfigPlugin (nuxt: Nuxt): Plugin {
  return {
    name: 'nuxt:vite-server:runtime-config',
    resolveId (id) {
      if (id === RUNTIME_CONFIG_ID) {
        return RESOLVED_RUNTIME_CONFIG_ID
      }
    },
    load (id) {
      if (id !== RESOLVED_RUNTIME_CONFIG_ID) {
        return
      }
      const { runtimeConfig } = nuxt.options
      if (this.environment.config.consumer === 'server') {
        const infer = (nuxt.options.future?.compatibilityVersion ?? 4) >= 5
        const schema = getRuntimeConfigSchema(runtimeConfig, nuxt.options._runtimeConfigSchemas, { infer })
        const strictPaths = infer ? '' : `, ${JSON.stringify(getStrictPaths(nuxt))}`
        return [
          `import { createRuntimeConfig } from 'nuxt/internal/runtime-config'`,
          `export const useRuntimeConfig = /* @__PURE__ */ createRuntimeConfig(${JSON.stringify(runtimeConfig)}, ${JSON.stringify(schema)}${strictPaths})`,
        ].join('\n')
      }
      return [
        `const config = ${JSON.stringify({ app: runtimeConfig.app, public: runtimeConfig.public })}`,
        `export const useRuntimeConfig = () => globalThis.__NUXT__?.config || config`,
      ].join('\n')
    },
  }
}

/** The paths of the schemas declared in `nuxt.config`, rather than by a module. */
function getStrictPaths (nuxt: Nuxt): string[] {
  return (nuxt.options._runtimeConfigSchemas ?? []).filter(entry => !entry.module).map(entry => entry.path.join('.'))
}
