import process from 'node:process'
import type { NuxtOptions } from '@nuxt/schema'

/**
 * Resolve the active Nuxt environment name, matching the value `c12` uses when
 * loading configuration. Precedence:
 * 1. explicit `envName` passed to `loadNuxtConfig` (e.g. `nuxt --envName`)
 * 2. `process.env.NODE_ENV`
 * 3. `'development'` in dev, `'production'` otherwise
 */
export function getNuxtEnvName (options: Pick<NuxtOptions, 'dev' | '_loadOptions'>): string {
  const explicit = options._loadOptions?.envName
  if (typeof explicit === 'string') {
    return explicit
  }
  return process.env.NODE_ENV || (options.dev ? 'development' : 'production')
}
