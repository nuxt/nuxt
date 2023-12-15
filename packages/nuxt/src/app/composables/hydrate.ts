import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '../nuxt'

/**
 * A SSR-friendly utility to call a method once
 * @param key a unique key ensuring the function can be properly de-duplicated across requests
 * @param fn a function to call
 */
export function once <T> (key?: string, fn?: (() => T | Promise<T>)): Promise<T>
export function once <T> (fn?: (() => T | Promise<T>)): Promise<T>
export async function once <T> (...args: any): Promise<T> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [_key, fn] = args as [string, (() => T | Promise<T>)]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [once] key must be a string: ' + _key)
  }
  if (fn !== undefined && typeof fn !== 'function') {
    throw new Error('[nuxt] [once] fn must be a function: ' + fn)
  }
  const nuxt = useNuxtApp()
  if (import.meta.server) {
    const res = await fn()
    nuxt.payload.calls[_key] = [res]
    return res
  }
  if (nuxt.isHydrating && nuxt.payload.calls[_key]) {
    return nuxt.payload.calls[_key][0]
  }
  return await fn()
}

/**
 * Allows full control of the hydration cycle to set and receive data from the server.
 * @param key a unique key to identify the data in the Nuxt payload
 * @param get a function that returns the value to set the initial data
 * @param set a function that will receive the data on the client-side
 */
export const useHydration = <K extends keyof NuxtPayload, T = NuxtPayload[K]> (key: K, get: () => T, set: (value: T) => void) => {
  const nuxt = useNuxtApp()

  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxt.payload[key] = get()
    })
  }

  if (import.meta.client) {
    nuxt.hooks.hook('app:created', () => {
      set(nuxt.payload[key] as T)
    })
  }
}
