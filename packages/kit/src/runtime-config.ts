import process from 'node:process'
import destr from 'destr'
import { snakeCase } from 'scule'
import { klona } from 'klona'
import type { NitroConfig, Nuxt } from '@nuxt/schema'
import type { RuntimeConfigSchemaEntry, RuntimeConfigSchemaNode } from '@nuxt/schema/internal'

import { defu } from 'defu'
import { applyRuntimeConfigSchema } from '../../nuxt/src/runtime/server/runtime-config/schema.ts'
import type { RuntimeConfigIssue } from '../../nuxt/src/runtime/server/runtime-config/schema.ts'
import { useNuxt } from './context.ts'
import { extractModuleRuntimeConfigSchemas, findRuntimeConfigSchema, getRuntimeConfigSchema, restoreRuntimeConfigSchemaNulls, stripRuntimeConfigSchemas } from './internal/runtime-config.ts'
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
 * Apply the current environment to the runtime config, returning it alongside the values
 * that do not match their schema.
 *
 * @internal
 */
export function resolveRuntimeConfig (nuxt: Nuxt): { config: Record<string, any>, issues: RuntimeConfigIssue[] } {
  const runtimeConfig = (nuxt.options.nitro as NitroConfig).runtimeConfig as Record<string, unknown>
  const config = klona(runtimeConfig)
  const options = {
    env: process.env,
    prefix: 'NITRO_',
    altPrefix: 'NUXT_',
    envExpansion: nuxt.options.nitro.experimental?.envExpansion ?? !!process.env.NITRO_ENV_EXPANSION,
  }
  if (!supportsRuntimeConfigSchemas(nuxt)) {
    return { config: applyEnv(config, options), issues: [] }
  }
  const infer = (nuxt.options.future?.compatibilityVersion ?? 4) >= 5
  const schema = getRuntimeConfigSchema(runtimeConfig, nuxt.options._runtimeConfigSchemas, { infer })
  if (!infer) {
    applyEnv(config, options, schema)
  }
  return { config, issues: applyRuntimeConfigSchema(config, schema, options) }
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

function supportsRuntimeConfigSchemas (nuxt: Nuxt): nuxt is Nuxt & { options: { _runtimeConfigSchemas: NonNullable<Nuxt['options']['_runtimeConfigSchemas']> } } {
  return Array.isArray(nuxt.options._runtimeConfigSchemas)
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

interface EnvOptions {
  prefix: string
  altPrefix: string
  envExpansion?: boolean
}

/**
 * Apply environment variables as Nitro does without runtime config schemas, casting each value
 * with `destr`. Values that `schema` describes are left to the schema.
 */
function applyEnv (obj: Record<string, any>, opts: EnvOptions, schema?: RuntimeConfigSchemaNode, parentKey = '') {
  for (const key in obj) {
    const node = typeof schema === 'object' && 'p' in schema ? schema.p[key] : undefined
    if (node && !(typeof node === 'object' && 'p' in node)) {
      continue
    }
    const subKey = parentKey ? `${parentKey}_${key}` : key
    const envKey = snakeCase(subKey).toUpperCase()
    const envValue = destr(process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey])
    if (isObject(obj[key])) {
      if (isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue }
        applyEnv(obj[key], opts, node, subKey)
      } else if (envValue === undefined) {
        applyEnv(obj[key], opts, node, subKey)
      } else {
        obj[key] = envValue ?? obj[key]
      }
    } else {
      obj[key] = envValue ?? obj[key]
    }
    if (opts.envExpansion && typeof obj[key] === 'string') {
      obj[key] = obj[key].replace(ENV_EXPANSION_RE, (match: string, name: string) => process.env[name] || match)
    }
  }
  return obj
}

const ENV_EXPANSION_RE = /\{\{([^{}]*)\}\}/g

function isObject (value: unknown): value is Record<string, any> {
  return typeof value === 'object' && !Array.isArray(value)
}
