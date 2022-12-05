import { useNuxtApp } from '../nuxt'
import { requestIdleCallback } from '../compat/idle-callback'

export const onNuxtReady = (callback: () => any) => {
  const nuxtApp = useNuxtApp()
  if (nuxtApp.isHydrating) {
    nuxtApp.hooks.hookOnce('app:suspense:resolve', () => { requestIdleCallback(callback) })
  } else {
    requestIdleCallback(callback)
  }
}
