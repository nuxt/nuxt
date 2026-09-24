declare module '#internal/nuxt.config.mjs'
declare module '#internal/nuxt/nitro-config.mjs'
declare module '#internal/nuxt/entry-ids.mjs'
declare module '#internal/nuxt/app-config'
declare module '#internal/entry-chunk.mjs'
declare module '#internal/nuxt/error-channel' {
  const errorChannel: typeof import('./runtime/utils/error-channel')
  export = errorChannel
}
declare module '#internal/nuxt/island-renderer.mjs'
declare module '#internal/unhead.config.mjs'
declare module '#internal/unhead-options.mjs'
declare module '#internal/dev-server-logs-options'
