import type { NitroConfig } from '@nuxt/schema'
import type { RuntimeConfigSchemaEntry } from '@nuxt/schema/internal'

import { defu } from 'defu'
import { useNuxt } from './context.ts'
import { extractModuleRuntimeConfigSchemas, findRuntimeConfigSchema, resolveRuntimeConfig, restoreRuntimeConfigSchemaNulls, stripRuntimeConfigSchemas, supportsRuntimeConfigSchemas } from './internal/runtime-config.ts'
import { tryUseNitro } from './nitro.ts'

/**
 * Access 'resolved' Nuxt runtime configuration, with values updated from environment.
 *
 * Environment variables are coerced to the type of the value they override, or of the schema
 * declared for it. A value that does not match keeps its default. Before
 * `compatibilityVersion: 5`, values without a schema are cast with `destr`, as at runtime.
 */
export function useRuntimeConfig (): Record<string, any> {
  return resolveRuntimeConfig(useNuxt()).config
}

/**
 * Update Nuxt runtime configuration.
 *
 * A value can be a [Standard Schema](https://standardschema.dev) that implements Standard JSON
 * Schema, which sets the type of the value and its default. A value already in the runtime
 * config, such as one set in `nuxt.config`, becomes the default of the schema, and a schema
 * declared in `nuxt.config` at the same path takes precedence. On versions of Nuxt without
 * support for runtime config schemas, a schema is replaced by its default value and is not
 * validated.
 *
 * @example
 * ```ts
 * updateRuntimeConfig({
 *   myModule: z.object({ apiKey: z.string(), retries: z.number().default(3) }),
 * })
 * ```
 */
export function updateRuntimeConfig (runtimeConfig: Record<string, unknown>): void | Promise<void> {
  const nuxt = useNuxt()
  const nitroConfig: NitroConfig = nuxt.options.nitro
  let entries: RuntimeConfigSchemaEntry[] = []
  if (findRuntimeConfigSchema(runtimeConfig)) {
    const current = nitroConfig.runtimeConfig as Record<string, unknown>
    if (supportsRuntimeConfigSchemas(nuxt)) {
      const previous = new Set(nuxt.options._runtimeConfigSchemas)
      runtimeConfig = extractModuleRuntimeConfigSchemas(runtimeConfig, current, nuxt.options._runtimeConfigSchemas)
      entries = nuxt.options._runtimeConfigSchemas.filter(entry => !previous.has(entry))
    } else {
      runtimeConfig = stripRuntimeConfigSchemas(runtimeConfig, current)
    }
  }
  const merge = (target: Record<string, unknown>) => {
    const merged = defu(runtimeConfig, target)
    restoreRuntimeConfigSchemaNulls(merged, runtimeConfig, entries)
    return merged
  }
  Object.assign(nitroConfig.runtimeConfig as Record<string, unknown>, merge(nitroConfig.runtimeConfig as Record<string, unknown>))

  const nitro = tryUseNitro()
  if (!nitro) {
    return
  }
  return nitro.updateConfig({
    // nitro coerces `undefined` to `''`, which would shadow derived keys such as `nitro.envExpansion`
    runtimeConfig: withoutUndefined(merge(nitro.options.runtimeConfig as Record<string, unknown>)) as any,
    // TODO: drop once `nitro.updateConfig({ runtimeConfig })` stops resetting `runtimeConfig.nitro.routeRules` from `config.routeRules`
    routeRules: (nitro.options as Record<string, any>).routeRules,
  })
}

function withoutUndefined<T> (value: T): T {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return value
  }
  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (child !== undefined) {
      result[key] = withoutUndefined(child)
    }
  }
  return result as T
}
