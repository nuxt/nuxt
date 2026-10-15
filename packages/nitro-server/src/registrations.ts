import { normalize } from 'pathe'
import { defineEventHandler, getRequestURL } from 'h3'
import { resolveAlias } from '@nuxt/kit'
import { kServerApi } from '@nuxt/kit/internal'
import type { DevServerHandler, Nuxt, ServerPlugin } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'

import { toPortableEvent } from './runtime/utils/event.ts'

/** Add the dev server handlers that nitro does not already hold a copy of from its config. */
export function addDevServerHandlers<T extends { handler: unknown }> (nitroHandlers: T[], handlers: T[]): void {
  const registered = new Set(nitroHandlers.map(entry => entry.handler))
  for (const entry of handlers) {
    if (!registered.has(entry.handler)) {
      nitroHandlers.push(entry)
    }
  }
}

/** The dev server handlers, with each `nuxt` variant given a `RequestEvent`. */
export function toPortableDevHandlers<T extends Pick<DevServerHandler, 'handler'>> (handlers: T[]): T[] {
  return handlers.map((entry) => {
    const handler = entry.handler
    if ((entry as Record<symbol, unknown>)[kServerApi] !== 'nuxt' || typeof handler !== 'function') {
      return entry
    }
    return {
      ...entry,
      // nitro mounts dev handlers by prefix, which strips the route from `event.path`
      handler: defineEventHandler(event => handler(toPortableEvent(event, () => getRequestURL(event)))),
    }
  })
}

/**
 * Write the server plugins gathered on `nuxt.options._serverPlugins`, which carry the server
 * API each was registered for, into the plain paths nitro takes.
 */
export function collectServerRegistrations (nuxt: Nuxt, nitroConfig: NitroConfig): void {
  nitroConfig.plugins ||= []
  for (const entry of (nuxt.options._serverPlugins || []) as ServerPlugin[]) {
    const path = normalize(resolveAlias(entry.plugin, nuxt.options.alias))
    if (!nitroConfig.plugins.includes(path)) {
      nitroConfig.plugins.push(path)
    }
  }
}
