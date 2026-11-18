/**
 * The nitro v2 runtime surface, implemented on nitro v3.
 *
 * `nitropack`, `nitropack/runtime`, `nitropack/runtime/*` and `#internal/nitro`
 * resolve here for server code being run through the compat layer.
 */
import { defineCachedHandler } from 'nitro/cache'
import type { H3Event } from 'nitro/h3'

import { fromLegacyBody } from './event.ts'

export { useNitroApp } from 'nitro/app'
export { getRouteRules } from '../utils/route-rules.ts'
export { defineErrorHandler as defineNitroErrorHandler, defineRouteMeta, definePlugin as defineNitroPlugin, definePlugin as nitroPlugin } from 'nitro'
export { useKV as useStorage } from 'nitro/kv'
export { defineTask, runTask } from 'nitro/task'
export { defineCachedFunction, defineCachedFunction as cachedFunction, defineCachedHandler } from 'nitro/cache'

/** v2 `defineCachedEventHandler`, which sends what the handler returns as h3 v1 did. */
export const defineCachedEventHandler: typeof defineCachedHandler = (handler, options) =>
  defineCachedHandler(async event => fromLegacyBody(event as H3Event, await handler(event)), options)
export { defineCachedEventHandler as cachedEventHandler }

export { useRuntimeConfig } from './runtime-config.ts'
export { defineRenderHandler } from './render.ts'
export { useEvent } from './event.ts'
export { useAppConfig } from '../utils/app-config.ts'

export * from './h3-v1.ts'
