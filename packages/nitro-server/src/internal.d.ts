declare module '#internal/nuxt.config.mjs'
declare module '#internal/nuxt/nitro-config.mjs'
declare module '#internal/nuxt/app-config'
declare module '#internal/nuxt/dev-client-css'
declare module '#internal/nuxt/error-channel' {
  const errorChannel: typeof import('./runtime/utils/error-channel')
  export = errorChannel
}
declare module '#internal/nuxt/host' {
  const host: typeof import('./runtime/host/nuxt4')
  export = host
}
declare module '#internal/nuxt/island-renderer.mjs'
declare module '#internal/nuxt/paths'
declare module '#internal/dev-server-logs-options'
declare module '#internal/nuxt/runtime-config-schema' {
  const schema: import('@nuxt/schema/internal').RuntimeConfigSchemaObject
  export default schema
  export const strictPaths: string[] | undefined
}
declare module '#nitro/virtual/runtime-config' {
  export const runtimeConfig: import('nitro/types').NitroRuntimeConfig
}
declare module '#nuxt-compat/import-meta' {
  export const entryURL: string
}
declare module '#nuxt-compat/flags' {
  /** Whether the app has any nitro v2 code, so the compat runtime is wanted. */
  export const legacyCompat: boolean
  /** Whether responses carry the headers Nitro v2 sent with them: `nitroLegacy.config` on a Nuxt 4 host. */
  export const legacyResponseHeaders: boolean
}
