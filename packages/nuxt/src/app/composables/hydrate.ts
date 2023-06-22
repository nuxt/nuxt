import { useNuxtApp } from '../nuxt'
import type { NuxtApp } from '#app'

/**
 * Allows full control of the hydration cycle to set and receive data from the server.
 *
 * @param key a unique key to identify the data in the Nuxt payload
 * @param get a function that returns the value to set the initial data
 * @param set a function that will receive the data on the client-side
 */
export const useHydration = <K extends keyof NuxtApp['payload'], T = NuxtApp['payload'][K]> (key: K, get: () => T, set: (value: T) => void) => {
  const nuxt = useNuxtApp()

  if (process.server) {
    nuxt.hooks.hook('app:rendered', () => {
      nuxt.payload[key] = get()
    })
  }

  if (process.client) {
    nuxt.hooks.hook('app:created', () => {
      set(nuxt.payload[key] as T)
    })
  }
}
