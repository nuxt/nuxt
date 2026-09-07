import { AsyncLocalStorage } from 'node:async_hooks'
import { getContext } from 'unctx'
import type { Nuxt } from '@nuxt/schema'
import { kitDiagnostics } from './diagnostics/kit-api.ts'

/**
 * A handle to the global Nuxt instance context.
 * @deprecated Use `getNuxtCtx` instead
 */
export interface NuxtContext {
  /** Get the current Nuxt instance. Throws if none is set. */
  use: () => Nuxt
  /** Get the current Nuxt instance, or `null` when none is set. */
  tryUse: () => Nuxt | null
  /** Set the current Nuxt instance. */
  set: (instance?: Nuxt, replace?: boolean) => void
  /** Clear the current Nuxt instance. */
  unset: () => void
  /** Run a synchronous function with the provided Nuxt instance set. */
  call: <R>(instance: Nuxt, callback: () => R) => R
  /** Run an asynchronous function with the provided Nuxt instance set. */
  callAsync: <R>(instance: Nuxt, callback: () => R | Promise<R>) => Promise<R>
}

/**
 * Direct access to the Nuxt global context.
 * @deprecated Use `getNuxtCtx` instead
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export const nuxtCtx: NuxtContext = getContext<Nuxt>('nuxt')

/** async local storage for the name of the current nuxt instance */
const asyncNuxtStorage = getContext<Nuxt>('asyncNuxtStorage', {
  asyncContext: true,
  AsyncLocalStorage,
})

/** Direct access to the Nuxt context with asyncLocalStorage - see https://github.com/unjs/unctx. */
export const getNuxtCtx = (): Nuxt | null => asyncNuxtStorage.tryUse()

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
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const instance = asyncNuxtStorage.tryUse() || nuxtCtx.tryUse()
  if (!instance) {
    throw kitDiagnostics.NUXT_B8001()
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return asyncNuxtStorage.tryUse() || nuxtCtx.tryUse()
}

export function runWithNuxtContext<T extends (...args: any[]) => any> (nuxt: Nuxt, fn: T) {
  return asyncNuxtStorage.call(nuxt, fn) as ReturnType<T>
}
