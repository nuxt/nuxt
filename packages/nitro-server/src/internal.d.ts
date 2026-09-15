declare module '#internal/nuxt.config.mjs'
declare module '#internal/nuxt/nitro-config.mjs'
declare module '#internal/nuxt/app-config'
declare module '#internal/nuxt/dev-client-css'
declare module '#internal/nuxt/island-renderer.mjs'
declare module '#internal/dev-server-logs-options'
declare module '#nuxt-compat/import-meta' {
  export const entryURL: string
}
declare module '#nuxt-compat/flags' {
  /** Whether the app has any nitro v2 code, so the compat runtime is wanted. */
  export const legacyCompat: boolean
}
