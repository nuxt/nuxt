import { getContext } from 'unctx'
import type { Nuxt } from '@nuxt/schema'

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
