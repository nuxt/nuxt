import { isRef, toRef } from 'vue'
import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 *
 * @param key a unique key ensuring that data fetching can be properly de-duplicated across requests
 * @param init a function that provides initial value for the state when it's not initiated
 */
export const useState = <T> (key: string, init?: (() => T | Ref<T>)): Ref<T> => {
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
