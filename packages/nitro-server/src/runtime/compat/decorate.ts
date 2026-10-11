import { fetchWithEvent } from 'nitro/h3'
import { createFetch } from 'ofetch'
import type { H3Event } from 'nitro/h3'
import type { NitroApp } from 'nitro/types'

import { prepareLegacyEvent } from './event.ts'

/**
 * Decorate an event with the Nitro v2 properties module code reads off it.
 *
 * Module utilities are routinely handed an event from a route the compat layer never
 * wrapped, so this cannot be done at the handler entry. Every property is a lazy getter.
 */
export function decorateLegacyEvent (event: H3Event, nitroApp?: Partial<NitroApp>): H3Event {
  prepareLegacyEvent(event)

  // a sub-request is dispatched through `event.app`, which an event built outside h3's
  // own routing (the render event) does not have
  if (!event.app && nitroApp?.h3) {
    event.app = nitroApp.h3 as NonNullable<H3Event['app']>
  }

  define(event, 'fetch', () => (request: any, init?: any) => eventFetch(event, request, init))
  define(event, '$fetch', () => createFetch({ fetch: ((request: any, init?: any) => eventFetch(event, request, init)) as typeof globalThis.fetch }))

  define(event, 'captureError', () => (error: unknown, context?: Record<string, unknown>) => {
    const capture = nitroApp?.captureError
    if (capture) {
      capture(error instanceof Error ? error : new Error(String(error), { cause: error }), { event, ...context })
      return
    }
    ;(event.context as Record<string, any>).nitro.errors.push({ error, context })
  })

  return event
}

/**
 * v2's `event.$fetch`/`event.fetch` dispatched a path into the running app with the
 * incoming request headers forwarded, and anything else through plain fetch.
 *
 * The decision is made by comparing origins after resolution rather than by inspecting
 * characters as h3 does: `//host` and `/\host` resolve to another origin, and a
 * sub-request built from those would carry the caller's cookies to it.
 */
function resolveInternalPath (event: H3Event, url: unknown): string | undefined {
  if (typeof url !== 'string' || url[0] !== '/' || !event.app) {
    return
  }
  try {
    const resolved = new URL(url, event.url)
    if (resolved.origin !== event.url.origin) {
      return
    }

    const path = resolved.pathname + resolved.search + resolved.hash

    // validated after normalisation, on the exact value handed to h3, because h3 resolves
    // again: dot-segment removal turns `/.//evil.example/x` into the pathname
    // `//evil.example/x`, which is same-origin here and another origin there
    if (path[1] === '/' || path[1] === '\\') {
      return
    }

    return path
  } catch {
    return
  }
}

function eventFetch (event: H3Event, request: any, init?: any) {
  const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request?.url
  // a `Request` keeps its method, headers and body in internal slots, so spreading it
  // yields none of them; the overrides are merged by `Request` itself instead
  const merged: Request | undefined = typeof request === 'object' && request !== null && !(request instanceof URL) && typeof url === 'string'
    ? (init ? new Request(request as Request, init) : request as Request)
    : undefined

  const internal = resolveInternalPath(event, url)
  if (internal === undefined) {
    return merged ? globalThis.fetch(merged) : globalThis.fetch(url ?? request, init)
  }

  // `fetchWithEvent` builds the sub-request with `new Request(url, { ...init })`, which a
  // `Request` passed as init would not survive either
  return fetchWithEvent(event, internal, merged ? toRequestInit(merged) : init)
}

/** A `Request`'s own fields as a plain init, for a consumer that spreads it. */
function toRequestInit (request: Request): RequestInit {
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    redirect: request.redirect,
    signal: request.signal,
  }
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
    init.duplex = 'half'
  }
  return init
}

function define (event: H3Event, property: string, factory: () => unknown) {
  if (property in event) {
    return
  }
  let value: unknown
  let resolved = false
  Object.defineProperty(event, property, {
    configurable: true,
    get () {
      if (!resolved) {
        value = factory()
        resolved = true
      }
      return value
    },
    set (next: unknown) {
      value = next
      resolved = true
    },
  })
}
