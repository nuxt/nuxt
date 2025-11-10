import type { MaybeRefOrGetter, Ref, UnwrapRef } from 'vue'
import { toRef, toValue } from 'vue'
import { type NuxtApp, useNuxtApp } from '../nuxt'
import { toArray } from '../utils'

const useStateKeyPrefix = '$s'
const getDefault = () => undefined

type InitOption<T> = (() => MaybeRefOrGetter<T>)
type UseStateOptions<T> = InitOption<T>

/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 * @since 3.0.0
 * @param key a unique key ensuring that data fetching can be properly de-duplicated across requests
 * @param init a function that provides initial value for the state when it's not initiated
 */
export function useState<T> (key?: string, init?: UseStateOptions<T>): Ref<UnwrapRef<T>>
export function useState<T> (init?: UseStateOptions<T>): Ref<T>
export function useState<T> (...args: any): Ref<T> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') {
    args.unshift(autoKey)
  }
  const [_key, init] = args as [unknown, InitOption<T>]
  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [useState] key must be a string: ' + _key)
  }
  if (init !== undefined && typeof init !== 'function') {
    throw new Error('[nuxt] [useState] init must be a function: ' + init)
  }
  const key = useStateKeyPrefix + _key
  const defaultFn = init || getDefault as () => T

  const nuxtApp = useNuxtApp()
  const state = toRef(nuxtApp.payload.state, key)
  nuxtApp._state[key] ??= {
    data: state,
    _default: defaultFn,
  }
  if (state.value === undefined) {
    nuxtApp.payload.state[key] = toValue(defaultFn)
  }

  return state as Ref<T>
}

/** @since 3.6.0 */
export function clearNuxtState (
  keys?: string | string[] | ((key: string) => boolean),
  reset?: boolean,
): void {
  const nuxtApp = useNuxtApp()
  const _allKeys = Object.keys(nuxtApp.payload.state)
    .filter(key => key.startsWith(useStateKeyPrefix))
    .map(key => key.substring(useStateKeyPrefix.length))

  const _keys: string[] = !keys
    ? _allKeys
    : typeof keys === 'function'
      ? _allKeys.filter(keys)
      : toArray(keys)

  for (const _key of _keys) {
    clearNuxtStateByKey(nuxtApp, useStateKeyPrefix + _key, reset ?? false)
  }
}

function clearNuxtStateByKey (nuxtApp: NuxtApp, key: string, reset: boolean): void {
  if (key in nuxtApp.payload.state) {
    nuxtApp.payload.state[key] = undefined
  }

  if (nuxtApp._state[key]) {
    nuxtApp._state[key]!.data.value = reset ? toValue(unref(nuxtApp._state[key]!._default)) : undefined
  }
}
