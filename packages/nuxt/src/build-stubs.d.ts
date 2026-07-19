/**
 * opaque module stubs for `#build/*` virtuals so the workspace-level
 * `pnpm typecheck` can compile Nuxt's own runtime sources directly
 */
declare module '#build/app-component.mjs'
declare module '#build/app.config.mjs'
declare module '#build/component-chunk'
declare module '#build/component-chunk.mjs'
declare module '#build/component-names.mjs'
declare module '#build/components'
declare module '#build/components.islands.mjs'
declare module '#build/components.plugin.mjs'
declare module '#build/css'
declare module '#build/css.mjs'
declare module '#build/error-component.mjs'

declare module '#build/fetch' {
  const $fetch: import('nitro/types').$Fetch
  export { $fetch }
}
declare module '#build/fetch.client.mjs' {
  const $fetch: import('nitro/types').$Fetch
  export { $fetch }
}
declare module '#build/fetch.server.mjs' {
  const $fetch: import('nitro/types').$Fetch
  export { $fetch }
}

declare module '#build/global-polyfills.mjs'
declare module '#build/island-renderer'
declare module '#build/island-renderer.mjs'
declare module '#build/layouts'
declare module '#build/layouts.mjs'
declare module '#build/middleware'
declare module '#build/middleware.mjs'
declare module '#build/nitro.client.mjs'
declare module '#build/nuxt.config.mjs'
declare module '#build/pages'
declare module '#build/pages.mjs'
declare module '#build/paths.mjs'
declare module '#build/plugins'
declare module '#build/plugins.client.mjs'
declare module '#build/plugins.server.mjs'
declare module '#build/root-component.mjs'
declare module '#build/route-rules.mjs'
declare module '#build/test-component-wrapper.mjs'
declare module '#build/unhead-options.mjs'
declare module '#build/unhead.config.mjs'

declare module '#components'
declare module '#imports'
declare module '#app-manifest'
declare module '#internal/*'
declare module '#spa-template'
