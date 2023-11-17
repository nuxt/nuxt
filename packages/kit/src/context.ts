import { getContext } from 'unctx'
import { type Nuxt } from '@nuxt/schema'

/** Direct access to the Nuxt context - see https://github.com/unjs/unctx. */
export const nuxtContext = getContext<Nuxt>('nuxt')

/**
 * Get the Nuxt instance from the context. It will throw an error if Nuxt is not available.
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 * @returns Nuxt instance
 * @throws Will throw an error if Nuxt instance in not available.
 * @see {@link https://nuxt.com/docs/api/kit/context#usenuxt documentation}
 */
export function useNuxt(): Nuxt {
  const instance = nuxtContext.tryUse()

  if (!instance) {
    throw new Error('Nuxt instance is unavailable!')
  }

  return instance
}

/**
 * Get the Nuxt instance from the context. It will return `null` if Nuxt is not available.
 * @example
 * ```js
 * const nuxt = tryUseNuxt()
 *
 * if (nuxt) {
 *  // Do something
 * }
 * ```
 * @returns Nuxt instance if available, `null` otherwise
 * @see {@link https://nuxt.com/docs/api/kit/context#tryusenuxt documentation}
 */
export function tryUseNuxt(): Nuxt | null {
  return nuxtContext.tryUse()
}
