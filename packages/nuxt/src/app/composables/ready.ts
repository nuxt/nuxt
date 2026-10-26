import { useNuxtApp } from '../nuxt'
import { requestIdleCallback } from '../compat/idle-callback'

export interface OnNuxtReadyOptions {
  /**
   * Maximum time in milliseconds to wait for the browser to become idle before running the callback.
   * Passed to `requestIdleCallback` as its `timeout` option.
   */
  timeout?: number
}

/** @since 3.1.0 */
export const onNuxtReady = (callback: () => any, options?: OnNuxtReadyOptions): void => {
  if (import.meta.server) { return }

  const nuxtApp = useNuxtApp()
  if (nuxtApp.isHydrating) {
    nuxtApp.hooks.hookOnce('app:suspense:resolve', () => { requestIdleCallback(() => callback(), options) })
  } else {
    requestIdleCallback(() => callback(), options)
  }
}
