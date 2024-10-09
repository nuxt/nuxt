import { useNuxtApp } from '../nuxt'
import type { NuxtPayload } from '../nuxt'

/**
 * Allows full control of the hydration cycle to set and receive data from the server.
 * @param key a unique key to identify the data in the Nuxt payload
 * @param get a function that returns the value to set the initial data
 * @param set a function that will receive the data on the client-side
 * @since 3.0.0
 */
export const useHydration = <K extends keyof NuxtPayload, T = NuxtPayload[K]> (key: K, get: () => T, set: (value: T) => void) => {
  const nuxtApp = useNuxtApp()

  if (import.meta.server) {
    nuxtApp.hooks.hook('app:rendered', () => {
      nuxtApp.payload[key] = get()
    })
  }

  if (import.meta.client) {
    nuxtApp.hooks.hook('app:created', () => {
      set(nuxtApp.payload[key] as T)
    })
  }
}
