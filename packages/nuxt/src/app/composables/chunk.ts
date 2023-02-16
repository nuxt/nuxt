export interface ReloadNuxtAppOptions {
  path?: string
}

export function reloadNuxtApp (options?: ReloadNuxtAppOptions) {
  const path = options?.path || window.location.pathname

  let handledPath: Record<string, any> = {}
  try {
    handledPath = JSON.parse(localStorage.getItem('nuxt:reload') || '{}')
  } catch {}

  if (handledPath?.path !== path || handledPath?.expires < Date.now()) {
    localStorage.setItem('nuxt:reload', JSON.stringify({ path, expires: Date.now() + 10000 }))
    if (window.location.pathname !== path) {
      window.location.href = path
    } else {
      window.location.reload()
    }
  }
}
