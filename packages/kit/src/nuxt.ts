import { getContext } from 'unctx'
import type { Nuxt } from './types/nuxt'
import type { NuxtConfig } from './types/config'

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
