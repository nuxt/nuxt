declare module '#internal/nuxt.config.mjs'
declare module '#internal/nuxt/nitro-config.mjs'
declare module '#internal/nuxt/paths' {
  export const baseURL: () => string
  export const buildAssetsDir: () => string
  export const buildAssetsURL: (...path: string[]) => string
  export const publicAssetsURL: (...path: string[]) => string
}
declare module '#internal/nuxt/app-config'
declare module '#internal/nuxt/dev-client-css'
declare module '#internal/nuxt/island-renderer.mjs'
declare module '#internal/dev-server-logs-options'
