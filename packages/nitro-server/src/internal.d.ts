declare module '#internal/nuxt.config.mjs'
declare module '#internal/nuxt/nitro-config.mjs'
declare module '#internal/nuxt/route-rules.mjs' {
  export const normalizeRouteRulePath: (path: string) => string
  export const matchAllRouteRules: <T>(match: (path: string) => T[], path: string) => T[]
}
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
declare module '#nitro-internal-virtual/app-config' {
  export const appConfig: Record<string, unknown>
}
declare module '#internal/nuxt/runtime-config-schema' {
  const schema: import('@nuxt/schema/internal').RuntimeConfigSchemaObject
  export default schema
  export const strictPaths: string[] | undefined
}
