import { getContext } from 'unctx'
import type { Nuxt } from './types/nuxt'
import type { NuxtConfig } from './types/config'
import type { LoadNuxtConfigOptions } from './config/load'
import { requireModule } from './utils/cjs'

/** Direct access to the Nuxt context - see https://github.com/unjs/unctx. */
export const nuxtCtx = getContext<Nuxt>('nuxt')

/**
 * Get access to Nuxt (if run within the Nuxt context) - see https://github.com/unjs/unctx.
 *
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 */
export const useNuxt = nuxtCtx.use

/**
 * This helper serves to add the correct typings for your `nuxt.config.js`.
 *
 * @example
 * ```ts
 * import { defineNuxtConfig } from '@nuxt/kit'
 * export default defineNuxtConfig({
 *   // your Nuxt config
 * })
 */
export function defineNuxtConfig (config: NuxtConfig) {
  return config
}

export interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  rootDir: string
  dev?: boolean
  config?: NuxtConfig
  version?: 2 | 3
  configFile?: string
  ready?: boolean
}

export async function loadNuxt (opts: LoadNuxtOptions): Promise<Nuxt> {
  // Nuxt 3
  if (opts.version !== 2) {
    const { loadNuxt } = requireModule('nuxt3', { paths: opts.rootDir })
    const nuxt = await loadNuxt(opts)
    return nuxt
  }

  // Compat
  // @ts-ignore
  const { loadNuxt } = requireModule('nuxt', { paths: opts.rootDir })
  const nuxt = await loadNuxt({
    rootDir: opts.rootDir,
    for: opts.dev ? 'dev' : 'build',
    configOverrides: opts.config,
    ready: opts.ready
  })
  return nuxt as Nuxt
}

export function buildNuxt (nuxt: Nuxt): Promise<any> {
  // Nuxt 3
  if (nuxt.options._majorVersion === 3) {
    const { build } = requireModule('nuxt3', { paths: nuxt.options.rootDir })
    return build(nuxt)
  }

  // Compat
  // @ts-ignore
  const { build } = requireModule('nuxt', { paths: nuxt.options.rootDir })
  return build(nuxt)
}
