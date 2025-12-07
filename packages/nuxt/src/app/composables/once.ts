import { useRouter } from './router'
import { useNuxtApp } from '../nuxt'

type CallOnceOptions = {
  mode?: 'navigation' | 'render'
}

let _isHmrUpdating = false

/**
 * An SSR-friendly utility to call a method once
 * @param key a unique key ensuring the function can be properly de-duplicated across requests
 * @param fn a function to call
 * @param options Setup the mode, e.g. to re-execute on navigation
 * @see https://nuxt.com/docs/4.x/api/utils/call-once
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
    const cleanups: Array<() => void> = []
    function callback () {
      nuxtApp.payload.once.delete(_key)
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
    cleanups.push(nuxtApp.hooks.hook('page:start', callback), useRouter().beforeResolve(callback))
  }

  // If key already ran
  if (nuxtApp.payload.once.has(_key)) {
    // Allow re-execution during HMR
    if (!import.meta.dev || !_isHmrUpdating) {
      return
    }
  }

  nuxtApp._once ||= {}
  nuxtApp._once[_key] ||= fn() || true
  await nuxtApp._once[_key]
  nuxtApp.payload.once.add(_key)
  delete nuxtApp._once[_key]
}

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', (payload) => {
    if (payload.updates.some((u: any) => u.type === 'js-update')) {
      _isHmrUpdating = true
    }
  })

  import.meta.hot.on('vite:afterUpdate', (payload) => {
    if (payload.updates.some((u: any) => u.type === 'js-update')) {
      _isHmrUpdating = false
    }
  })
}
