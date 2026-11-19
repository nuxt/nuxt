/**
 * The nitro v2 runtime surface, implemented on nitro v3.
 *
 * `nitropack`, `nitropack/runtime`, `nitropack/runtime/*` and `#internal/nitro`
 * resolve here for server code being run through the compat layer.
 */
import { useNitroApp as useNitroV3App } from 'nitro/app'
import type { NitroApp } from 'nitro/types'

import { toLegacyApp } from './legacy-plugin.ts'

/** The `nitroApp` that Nitro v2 plugins receive. */
export function useNitroApp (): NitroApp {
  return toLegacyApp(useNitroV3App())
}

export { getRouteRules } from '../utils/route-rules.ts'
export { defineErrorHandler as defineNitroErrorHandler, defineRouteMeta, definePlugin as defineNitroPlugin, definePlugin as nitroPlugin } from 'nitro'
export { useKV as useStorage } from 'nitro/kv'
export { defineTask, runTask } from 'nitro/task'
export { defineCachedFunction, defineCachedFunction as cachedFunction, defineCachedHandler } from 'nitro/cache'
export { cachedEventHandler, defineCachedEventHandler } from './cache.ts'

export { useRuntimeConfig } from './runtime-config.ts'
export { defineRenderHandler } from './render.ts'
export { useEvent } from './event.ts'
export { useAppConfig } from '../utils/app-config.ts'

export * from './h3-v1.ts'
