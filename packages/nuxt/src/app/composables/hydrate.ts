import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '#app'

/**
 * Allows full control of the hydration cycle to set and receive data from the server.
 *
 * @param key a unique key to identify the data in the Nuxt payload
 * @param get a function that returns the value to set the initial data
 * @param set a function that will receive the data on the client-side
 */
export const useHydration = <K extends keyof NuxtPayload, T = NuxtPayload[K]> (key: K, get: () => T, set: (value: T) => void) => {
  const nuxt = useNuxtApp()

  if (import.meta.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxt.payload[key] = get()
    })
  }

  if (import.meta.client) {
    nuxt.hooks.hook('app:created', () => {
      set(nuxt.payload[key] as T)
    })
  }
}
