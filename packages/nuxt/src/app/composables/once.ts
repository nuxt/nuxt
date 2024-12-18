import { useNuxtApp } from '../nuxt'

type CallOnceOptions = {
  mode?: 'navigation' | 'render'
}

/**
 * An SSR-friendly utility to call a method once
 * @param key a unique key ensuring the function can be properly de-duplicated across requests
 * @param fn a function to call
 * @param options Setup the mode, e.g. to re-execute on navigation
 * @see https://nuxt.com/docs/api/utils/call-once
 * @since 3.9.0
 */
export function callOnce (key?: string, fn?: (() => any | Promise<any>), options?: CallOnceOptions): Promise<void>
export function callOnce (fn?: (() => any | Promise<any>), options?: CallOnceOptions): Promise<void>
export async function callOnce (...args: any): Promise<void> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [_key, fn, options] = args as [string, (() => any | Promise<any>), CallOnceOptions | undefined]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [callOnce] key must be a string: ' + _key)
  }
  if (fn !== undefined && typeof fn !== 'function') {
    throw new Error('[nuxt] [callOnce] fn must be a function: ' + fn)
  }
  const nuxtApp = useNuxtApp()

  if (options?.mode === 'navigation') {
    nuxtApp.hooks.hookOnce('page:start', () => {
      nuxtApp.payload.once.delete(_key)
    })
  }

  // If key already ran
  if (nuxtApp.payload.once.has(_key)) {
    return
  }

  nuxtApp._once = nuxtApp._once || {}
  nuxtApp._once[_key] = nuxtApp._once[_key] || fn() || true
  await nuxtApp._once[_key]
  nuxtApp.payload.once.add(_key)
  delete nuxtApp._once[_key]
}
