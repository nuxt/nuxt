import { getContext } from 'unctx'
import { requireModule, tryRequireModule, tryResolveModule } from './utils/cjs'
import type { Nuxt } from './types/nuxt'
import type { NuxtConfig } from './types/config'
import type { LoadNuxtConfigOptions } from './config/load'

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
  const resolveOpts = { paths: opts.rootDir }

  // Detect version
  if (!opts.version) {
    opts.version = tryResolveModule('nuxt3', resolveOpts) ? 3 : 2
  }

  // Nuxt 3
  if (opts.version !== 2) {
    const { loadNuxt } = requireModule('nuxt3', resolveOpts)
    const nuxt = await loadNuxt(opts)
    return nuxt
  }

  // Nuxt 2
  // @ts-ignore
  const { loadNuxt } = tryRequireModule('nuxt-edge', resolveOpts) || requireModule('nuxt', resolveOpts)
  const nuxt = await loadNuxt({
    rootDir: opts.rootDir,
    for: opts.dev ? 'dev' : 'build',
    configOverrides: opts.config,
    ready: opts.ready,
    envConfig: opts.envConfig
  })
  return nuxt as Nuxt
}

export function buildNuxt (nuxt: Nuxt): Promise<any> {
  const resolveOpts = { paths: nuxt.options.rootDir }

  // Nuxt 3
  if (nuxt.options._majorVersion === 3) {
    const { build } = requireModule('nuxt3', resolveOpts)
    return build(nuxt)
  }

  // Nuxt 2
  // @ts-ignore
  const { build } = tryRequireModule('nuxt-edge', resolveOpts) || requireModule('nuxt', resolveOpts)
  return build(nuxt)
}
