/**
 * h3 compatibility layer for Nuxt runtime code.
 *
 * Note: do not add named `export { … } from 'h3'` here. tsdown/rolldown rewrites
 * those into `import { … } from 'h3'; export { … }`, which triggers Rollup's
 * UNUSED_EXTERNAL_IMPORT warning during `nuxt generate` prerender when only a
 * subset of those bindings is used. `export *` preserves the public API without
 * that warning.
 */
export * from 'h3'
export type { EventHandlerRequest } from 'h3'
