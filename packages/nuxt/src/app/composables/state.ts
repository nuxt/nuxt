import { computed, isRef, toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'

type UseStateOptions<T> = {
  serializer?: {
    read: (value: any) => T
    write: (value: T) => unknown
  }
}

const useStateKeyPrefix = '$s'
/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 * @since 3.0.0
 * @param key a unique key ensuring that data fetching can be properly de-duplicated across requests
 * @param init a function that provides initial value for the state when it's not initiated
 * @param options options to transform the state on get/set
 */
export function useState<T> (key?: string, init?: (() => T | Ref<T>), options?: UseStateOptions<T>): Ref<T>
export function useState<T> (init?: (() => T | Ref<T>), options?: UseStateOptions<T>): Ref<T>
export function useState<T> (...args: any): Ref<T> {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : undefined
  if (typeof args[0] !== 'string') { args.unshift(autoKey) }
  const [_key, init, options = {}] = args as [string, (() => T | Ref<T>), UseStateOptions<T>]

  if (!_key || typeof _key !== 'string') {
    throw new TypeError('[nuxt] [useState] key must be a string: ' + _key)
  }
  if (init !== undefined && typeof init !== 'function') {
    throw new Error('[nuxt] [useState] init must be a function: ' + init)
  }
  const key = useStateKeyPrefix + _key

  const nuxtApp = useNuxtApp()
  const _state = toRef(nuxtApp.payload.state, key)

  const serializerWrite = options.serializer?.write || ((v: T) => v)
  const serializerRead = options.serializer?.read || ((v: any) => v as T)

  const state = computed<T>({
    get () {
      return serializerRead(_state.value)
    },
    set (value) {
      _state.value = serializerWrite(value)
    },
  })
  if (_state.value === undefined && init) {
    const initialValue = init()
    if (isRef(initialValue)) {
      // vue will unwrap the ref for us
      nuxtApp.payload.state[key] = serializerWrite(initialValue.value)
      return initialValue as Ref<T>
    }
    state.value = initialValue
  }
  return state
}

/** @since 3.6.0 */
export function clearNuxtState (
  keys?: string | string[] | ((key: string) => boolean),
): void {
  const nuxtApp = useNuxtApp()
  const _allKeys = Object.keys(nuxtApp.payload.state)
    .map(key => key.substring(useStateKeyPrefix.length))

  const _keys: string[] = !keys
    ? _allKeys
    : typeof keys === 'function'
      ? _allKeys.filter(keys)
      : toArray(keys)

  for (const _key of _keys) {
    const key = useStateKeyPrefix + _key
    if (key in nuxtApp.payload.state) {
      nuxtApp.payload.state[key] = undefined
    }
  }
}
