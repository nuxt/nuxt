import { useNuxtApp } from '../nuxt'

/**
 * An SSR-friendly utility to call a method once
 * @param key a unique key ensuring the function can be properly de-duplicated across requests
 * @param fn a function to call
 * @see https://nuxt.com/docs/api/utils/call-once
 */
export function callOnce (key?: string, fn?: (() => any | Promise<any>)): Promise<void>
export function callOnce (fn?: (() => any | Promise<any>)): Promise<void>
export async function callOnce (...args: any): Promise<void> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [_key, fn] = args as [string, (() => any | Promise<any>)]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [callOnce] key must be a string: ' + _key)
  }
  if (fn !== undefined && typeof fn !== 'function') {
    throw new Error('[nuxt] [callOnce] fn must be a function: ' + fn)
  }
  const nuxt = useNuxtApp()
  // If key already ran
  if (nuxt.payload.once.has(_key)) {
    return
  }
  await fn()
  nuxt.payload.once.add(_key)
}
