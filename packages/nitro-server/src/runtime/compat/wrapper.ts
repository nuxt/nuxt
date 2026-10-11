import { defineHandler, toEventHandler } from 'nitro/h3'
import type { H3Event } from 'nitro/h3'

import { prepareLegacyEvent } from './event.ts'
import { toLegacyError } from './error-shape.ts'

/**
 * Wrap a handler written for nitro v2 so it sees the event and error shape it expects.
 * Import rewriting covers the rest of the surface.
 *
 * `base` is the route a middleware was mounted at. h3 v1 stripped it from the path for the
 * duration of that layer, and restored it for the next one, so it is restored here too.
 */
export function wrapLegacyHandler (input: unknown, base?: string): unknown {
  const handler = toEventHandler(input as any) as ((event: H3Event) => unknown) | undefined
  if (!handler) {
    return input
  }

  const wrapped = defineHandler(async (event: H3Event) => {
    prepareLegacyEvent(event)
    const url = base ? withStrippedBase(event, base) : undefined
    try {
      return await handler(event)
    } catch (error) {
      throw toLegacyError(error)
    } finally {
      if (url) {
        event.url = url
      }
    }
  })

  // carry over the markers Nitro and h3 read off a handler, minus the two this owns
  if (input && (typeof input === 'object' || typeof input === 'function')) {
    for (const key of [...Object.keys(input), ...Object.getOwnPropertySymbols(input)]) {
      if (key === 'handler' || key === 'fetch') {
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(input, key)
      if (descriptor) {
        Object.defineProperty(wrapped, key, descriptor)
      }
    }
  }

  return wrapped
}

/**
 * Replace `event.url` with one whose path is relative to `base`, returning the original for
 * the caller to restore. `event.path` reads off `event.url`, so both move together.
 */
function withStrippedBase (event: H3Event, base: string): URL | undefined {
  const { pathname } = event.url
  if (pathname !== base && !pathname.startsWith(`${base}/`)) {
    return
  }
  const original = event.url
  const stripped = new URL(original)
  stripped.pathname = pathname.slice(base.length) || '/'
  event.url = stripped
  return original
}
