import { getContext } from 'unctx'
import type { Nuxt } from '@nuxt/schema'
import { asyncNameStorage } from './utils'
import { logger } from './logger'

/** Direct access to the Nuxt context - see https://github.com/unjs/unctx. */
export const nuxtCtx = () => getContext<Nuxt>(asyncNameStorage.getStore()!)
export const fallbackNuxtCtx = getContext<Nuxt>('nuxt-fallback')

// TODO: Use use/tryUse from unctx. https://github.com/unjs/unctx/issues/6

/**
 * Get access to Nuxt instance.
 *
 * Throws an error if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 */
export function useNuxt (): Nuxt {
  const instance = nuxtCtx().tryUse()
  if (!instance) {
    const fallbackInstance = fallbackNuxtCtx.tryUse()
    if (fallbackInstance) {
      logger.warn('Using fallback global Nuxt instance. You may be using a @nuxt/kit composable outside of a Nuxt context, this behavior is deprecated and will be removed in v4.')
      return fallbackInstance }
      
    throw new Error('Nuxt instance is unavailable!')
  }
  return instance
}

/**
 * Get access to Nuxt instance.
 *
 * Returns null if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = tryUseNuxt()
 * if (nuxt) {
 *  // Do something
 * }
 * ```
 */
export function tryUseNuxt (): Nuxt | null {
  const nuxt = nuxtCtx().tryUse()
  if(!nuxt) {
    logger.warn('Using fallback global Nuxt instance. You may be using a @nuxt/kit composable outside of a Nuxt context, this behavior is deprecated and will be removed in v4.')
    return fallbackNuxtCtx.tryUse()
  }
  return nuxt
}
