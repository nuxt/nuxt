export interface ReloadNuxtAppOptions {
  /**
   * Number of milliseconds in which to ignore future reload requests
   *
   * @default {10000}
   */
  ttl?: number
  /**
   * Force a reload even if one has occurred within the previously specified TTL.
   *
   * @default {false}
   */
  force?: boolean
  /**
   * The path to reload. If this is different from the current window location it will
   * trigger a navigation and add an entry in the browser history.
   *
   * @default {window.location.pathname}
   */
  path?: string
}

export function reloadNuxtApp (options: ReloadNuxtAppOptions = {}) {
  const path = options.path || window.location.pathname

  let handledPath: Record<string, any> = {}
  try {
    handledPath = JSON.parse(localStorage.getItem('nuxt:reload') || '{}')
  } catch {}

  if (options.force || handledPath?.path !== path || handledPath?.expires < Date.now()) {
    localStorage.setItem('nuxt:reload', JSON.stringify({ path, expires: Date.now() + (options.ttl ?? 10000) }))
    if (window.location.pathname !== path) {
      window.location.href = path
    } else {
      window.location.reload()
    }
  }
}
