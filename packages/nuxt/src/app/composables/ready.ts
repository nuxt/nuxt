import { useNuxtApp } from '../nuxt'
import { requestIdleCallback } from '../compat/idle-callback'

/** @since 3.1.0 */
export const onNuxtReady = (callback: () => any) => {
  if (import.meta.server) { return }

  const nuxtApp = useNuxtApp()
  if (nuxtApp.isHydrating) {
    nuxtApp.hooks.hookOnce('app:suspense:resolve', () => { requestIdleCallback(callback) })
  } else {
    requestIdleCallback(callback)
  }
}
