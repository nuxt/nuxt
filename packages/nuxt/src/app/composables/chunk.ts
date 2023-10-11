import destr from 'destr'
import { useNuxtApp } from '#app/nuxt'

export interface ReloadNuxtAppOptions {
  /**
   * Number of milliseconds in which to ignore future reload requests
   * @default {10000}
   */
  ttl?: number
  /**
   * Force a reload even if one has occurred within the previously specified TTL.
   * @default {false}
   */
  force?: boolean
  /**
   * Whether to dump the current Nuxt state to sessionStorage (as `nuxt:reload:state`).
   * @default {false}
   */
  persistState?: boolean
  /**
   * The path to reload. If this is different from the current window location it will
   * trigger a navigation and add an entry in the browser history.
   * @default {window.location.pathname}
   */
  path?: string
}

export function reloadNuxtApp (options: ReloadNuxtAppOptions = {}) {
  if (import.meta.server) { return }
  const path = options.path || window.location.pathname

  let handledPath: Record<string, any> = {}
  try {
    handledPath = destr(sessionStorage.getItem('nuxt:reload') || '{}')
  } catch {}

  if (options.force || handledPath?.path !== path || handledPath?.expires < Date.now()) {
    try {
      sessionStorage.setItem('nuxt:reload', JSON.stringify({ path, expires: Date.now() + (options.ttl ?? 10000) }))
    } catch {}

    if (options.persistState) {
      try {
        // TODO: handle serializing/deserializing complex states as JSON: https://github.com/nuxt/nuxt/pull/19205
        sessionStorage.setItem('nuxt:reload:state', JSON.stringify({ state: useNuxtApp().payload.state }))
      } catch {}
    }

    if (window.location.pathname !== path) {
      window.location.href = path
    } else {
      window.location.reload()
    }
  }
}
