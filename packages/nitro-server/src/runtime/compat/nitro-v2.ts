/**
 * The nitro v2 runtime surface, implemented on nitro v3.
 *
 * `nitropack`, `nitropack/runtime`, `nitropack/runtime/*` and `#internal/nitro`
 * resolve here for server code being run through the compat layer.
 */
export { useNitroApp } from 'nitro/app'
export { getRouteRules } from '../utils/route-rules.ts'
export { defineErrorHandler as defineNitroErrorHandler, defineRouteMeta, definePlugin as defineNitroPlugin, definePlugin as nitroPlugin } from 'nitro'
export { useStorage } from 'nitro/storage'
export { defineTask, runTask } from 'nitro/task'
export {
  defineCachedFunction,
  defineCachedFunction as cachedFunction,
  defineCachedHandler,
  defineCachedHandler as defineCachedEventHandler,
  defineCachedHandler as cachedEventHandler,
} from 'nitro/cache'

export { useRuntimeConfig } from './runtime-config.ts'
export { defineRenderHandler } from './render.ts'
export { useEvent } from './event.ts'
export { useAppConfig } from '../utils/app-config.ts'

export * from './h3-v1.ts'
