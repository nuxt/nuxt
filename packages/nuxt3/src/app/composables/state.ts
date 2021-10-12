import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 *
 * @param key a unique key to identify the data in the Nuxt payload
 * @param init a function that provides initial value for state if it's not initiated
 */
export const useState = <T> (key: string, init?: (() => T)): Ref<T> => {
  const nuxt = useNuxtApp()
  const state = toRef(nuxt.payload.state, key)
  if (state.value === undefined && init) {
    state.value = init()
  }
  return state
}
