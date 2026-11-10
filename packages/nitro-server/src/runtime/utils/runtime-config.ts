import { klona } from 'klona'
import destr from 'destr'
import { snakeCase } from 'scule'
import type { RuntimeConfigSchemaNode, RuntimeConfigSchemaObject } from '@nuxt/schema/internal'
import { applyRuntimeConfigSchema } from 'nuxt/internal/runtime-config/schema'
import { checkRuntimeConfigIssues, partitionRuntimeConfigIssues, warnRuntimeConfigIssues } from 'nuxt/internal/runtime-config'

export interface RuntimeConfigEnvOptions {
  prefix: string
  altPrefix: string
  envExpansion: boolean
}

/** The environment options nitro applies to its serialised runtime config. */
export function getRuntimeConfigEnvOptions (config: Record<string, any>, env: Record<string, string | undefined>): RuntimeConfigEnvOptions {
  return {
    prefix: 'NITRO_',
    altPrefix: config.nitro?.envPrefix ?? env.NITRO_ENV_PREFIX ?? '_',
    envExpansion: Boolean(config.nitro?.envExpansion ?? env.NITRO_ENV_EXPANSION ?? false),
  }
}

/**
 * Create a function that applies environment variables to a copy of `config`. Values that
 * `schema` describes are coerced and validated; the rest are cast with `destr`, as nitro does.
 *
 * Invalid values throw, as do missing required values except while prerendering, when
 * reading a missing value throws instead. With `strictPaths`, only values at or below one
 * of those paths throw; the rest warn once and keep their default.
 */
export function createRuntimeConfigResolver<T extends Record<string, any>> (config: T, schema: RuntimeConfigSchemaObject, env: Record<string, string | undefined>, strictPaths?: string[]): () => T {
  const options = getRuntimeConfigEnvOptions(config, env)
  let error: Error | undefined
  let warned = false
  return () => {
    if (error) {
      throw error
    }
    const resolved = klona(config)
    const { fatal, lenient } = partitionRuntimeConfigIssues(applyRuntimeConfigSchema(resolved, schema, { env, ...options }), strictPaths)
    applyEnv(resolved, options, env, schema)
    if (!warned) {
      warned = true
      warnRuntimeConfigIssues(lenient)
    }
    try {
      return checkRuntimeConfigIssues(resolved, schema, fatal)
    } catch (cause) {
      throw error = cause as Error
    }
  }
}

/** Apply environment variables as nitro does, skipping the values that `node` describes. */
function applyEnv (obj: Record<string, any>, options: RuntimeConfigEnvOptions, env: Record<string, string | undefined>, node?: RuntimeConfigSchemaNode, parentKey = ''): void {
  for (const key in obj) {
    const child = isObjectNode(node) ? node.p[key] : undefined
    if (child && !isObjectNode(child)) {
      continue
    }
    const subKey = parentKey ? `${parentKey}_${key}` : key
    const envKey = snakeCase(subKey).toUpperCase()
    const envValue = destr(env[options.prefix + envKey] ?? env[options.altPrefix + envKey])
    if (isObjectNode(child)) {
      if (isObject(obj[key])) {
        if (isObject(envValue)) {
          obj[key] = { ...obj[key], ...Object.fromEntries(Object.entries(envValue ?? {}).filter(([name]) => !Object.hasOwn(child.p, name))) }
        }
        applyEnv(obj[key], options, env, child, subKey)
      }
      continue
    }
    if (isObject(obj[key])) {
      if (isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue }
        applyEnv(obj[key], options, env, undefined, subKey)
      } else if (envValue === undefined) {
        applyEnv(obj[key], options, env, undefined, subKey)
      } else {
        obj[key] = envValue ?? obj[key]
      }
    } else {
      obj[key] = envValue ?? obj[key]
    }
    if (options.envExpansion && typeof obj[key] === 'string') {
      obj[key] = (obj[key] as string).replace(ENV_EXPANSION_RE, (match: string, name: string) => env[name] || match)
    }
  }
}

const ENV_EXPANSION_RE = /\{\{([^{}]*)\}\}/g

function isObject (value: unknown): value is Record<string, any> {
  return typeof value === 'object' && !Array.isArray(value)
}

function isObjectNode (node: RuntimeConfigSchemaNode | undefined): node is RuntimeConfigSchemaObject {
  return typeof node === 'object' && 'p' in node
}
