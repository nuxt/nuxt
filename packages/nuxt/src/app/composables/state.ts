import { isRef, toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'

const useStateKeyPrefix = '$s'
/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 *
 * @param key a unique key ensuring that data fetching can be properly de-duplicated across requests
 * @param init a function that provides initial value for the state when it's not initiated
 */
export function useState <T> (key?: string, init?: (() => T | Ref<T>)): Ref<T>
export function useState <T> (init?: (() => T | Ref<T>)): Ref<T>
export function useState <T> (...args: any): Ref<T> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [_key, init] = args as [string, (() => T | Ref<T>)]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [useState] key must be a string: ' + _key)
  }
  if (init !== undefined && typeof init !== 'function') {
    throw new Error('[nuxt] [useState] init must be a function: ' + init)
  }
  const key = useStateKeyPrefix + _key

  const nuxt = useNuxtApp()
  const state = toRef(nuxt.payload.state, key)
  if (state.value === undefined && init) {
    const initialValue = init()
    if (isRef(initialValue)) {
      // vue will unwrap the ref for us
      nuxt.payload.state[key] = initialValue
      return initialValue as Ref<T>
    }
    state.value = initialValue
  }
  return state
}

export function clearNuxtState (
  keys?: string | string[] | ((key: string) => boolean)
): void {
  const nuxtApp = useNuxtApp()
  const _allKeys = Object.keys(nuxtApp.payload.state)
  const _keys: string[] = !keys
    ? _allKeys
    : typeof keys === 'function'
      ? _allKeys.filter(keys)
      : Array.isArray(keys) ? keys : [keys]

  for (const _key of _keys) {
    const key = useStateKeyPrefix + _key
    if (key in nuxtApp.payload.state) {
      nuxtApp.payload.state[key] = undefined
    }
  }
}
