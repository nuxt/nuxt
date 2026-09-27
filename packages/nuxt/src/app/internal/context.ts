import { getContext as getUnctxContext } from 'unctx'

/** Holds the active instance for a given context key. */
export interface NuxtAppContext<T> {
  /** Return the active instance, throwing when none is set. */
  use: () => T
  tryUse: () => T | null
  set: (instance?: T, replace?: boolean) => void
  unset: () => void
  call: <R> (instance: T, callback: () => R) => R
  callAsync: <R> (instance: T, callback: () => R | Promise<R>) => Promise<R>
}

// keyed on `globalThis` so duplicate module instances (e.g. in vitest) share the active app
const clientContexts: Record<string, NuxtAppContext<any>> = (globalThis as { __nuxt_app_ctx__?: Record<string, NuxtAppContext<any>> }).__nuxt_app_ctx__ ||= {}

/** Singleton stand-in for `unctx` in the browser, which has no `AsyncLocalStorage`. */
function getClientContext<T> (key: string): NuxtAppContext<T> {
  return clientContexts[key] ||= (() => {
    let instance: T | undefined
    return {
      use: () => {
        if (instance === undefined) { throw new Error('Context is not available') }
        return instance
      },
      tryUse: () => instance ?? null,
      set: (newInstance?: T) => { instance = newInstance },
      unset: () => { instance = undefined },
      call: (newInstance: T, callback: () => any) => {
        instance = newInstance
        return callback()
      },
      callAsync: (newInstance: T, callback: () => any) => {
        instance = newInstance
        return Promise.resolve(callback())
      },
    } as NuxtAppContext<T>
  })()
}

export function getContext<T> (key: string, opts: { asyncContext?: boolean }): NuxtAppContext<T> {
  if (import.meta.client) {
    return getClientContext<T>(key)
  }
  return getUnctxContext<T>(key, opts)
}
