import type { Ref } from 'vue'
import { useNuxtApp } from '#app'

/**
 * Create a global reactive ref that will be hydrated but not shared across ssr requests
 *
 * @param key a unique key to identify the data in the Nuxt payload
 */
export const useState = <T> (key: string): Ref<T> => {
  const nuxt = useNuxtApp()
  return toRef(nuxt.payload.state, key)
}
