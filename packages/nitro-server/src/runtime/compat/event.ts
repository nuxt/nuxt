import { H3Event } from 'nitro/h3'
import { useRequest } from 'nitro/context'
import { getRouteRules } from '../utils/route-rules.ts'
import type { H3Event as H3EventType } from 'nitro/h3'

const kEvent = Symbol.for('nuxt.compat.event')

/**
 * v2 `useEvent`. Requires `experimental.asyncContext`, as it did in nitro v2. Returns the
 * event the compat wrapper prepared where there is one, so response mutations are not lost.
 */
export function useEvent (): H3EventType {
  const request = useRequest()
  const context = (request as { context?: Record<string | symbol, any> }).context
  return context?.[kEvent] || new H3Event(request as any)
}

/**
 * Bring an h3 v2 event up to the shape v1 server code expects: a populated
 * `event.context.nitro`, the private `event.context._nitro.routeRules` slot nitro v2
 * populated from `getRouteRules(event)`, and, on runtimes where h3 has no real node
 * objects, an `event.node` bridge forwarding header and status writes onto the web response.
 */
export function prepareLegacyEvent (event: H3EventType): H3EventType {
  const context = event.context as Record<string | symbol, any>
  context[kEvent] = event

  // lazy: this runs on every event, and most never touch either of these
  if (context.nitro === undefined) {
    let nitro: Record<string, any> | undefined
    Object.defineProperty(context, 'nitro', {
      configurable: true,
      enumerable: true,
      get: () => (nitro ||= { errors: [] }),
      set: (value: Record<string, any>) => { nitro = value },
    })
  } else {
    context.nitro.errors ||= []
  }

  if (context._nitro === undefined) {
    let slot: Record<string, any> | undefined
    Object.defineProperty(context, '_nitro', {
      configurable: true,
      enumerable: false,
      get: () => (slot ||= createLegacyNitroSlot(event)),
      set: (value: Record<string, any>) => { slot = value },
    })
  }

  if (!event.req.runtime?.node) {
    let bridge: { req: unknown, res: unknown } | undefined
    Object.defineProperty(event, 'node', {
      configurable: true,
      get: () => (bridge ||= {
        req: createNodeRequestBridge(event),
        res: createNodeResponseBridge(event),
      }),
    })
  }

  return event
}

function createLegacyNitroSlot (event: H3EventType) {
  const slot: Record<string, any> = {}
  let rules: Record<string, any> | undefined
  Object.defineProperty(slot, 'routeRules', {
    configurable: true,
    enumerable: true,
    get: () => (rules ||= getRouteRules(event)),
    set: (value: Record<string, any>) => { rules = value },
  })
  return slot
}

function createNodeRequestBridge (event: H3EventType) {
  return {
    url: event.url.pathname + event.url.search,
    method: event.req.method,
    // a live view, as it would be on a real node request
    get headers () {
      const headers: Record<string, string> = {}
      for (const [key, value] of event.req.headers) {
        headers[key] = value
      }
      return headers
    },
    originalUrl: event.url.href,
  }
}

/**
 * node's `setHeader` replaces the header with every value it was given, so the previous
 * value is dropped before each entry is appended as a repeat of the header.
 */
function replaceHeader (event: H3EventType, name: string, value: string | string[] | number): void {
  event.res.headers.delete(name)
  for (const entry of Array.isArray(value) ? value : [value]) {
    event.res.headers.append(name, String(entry))
  }
}

function createNodeResponseBridge (event: H3EventType) {
  return {
    get statusCode () {
      return event.res.status
    },
    set statusCode (status: number | undefined) {
      event.res.status = status
    },
    get statusMessage () {
      return event.res.statusText
    },
    set statusMessage (statusText: string | undefined) {
      event.res.statusText = statusText
    },
    get headersSent () {
      return false
    },
    setHeader (name: string, value: string | string[]) {
      replaceHeader(event, name, value)
      return this
    },
    appendHeader (name: string, value: string) {
      event.res.headers.append(name, value)
      return this
    },
    getHeader (name: string) {
      return event.res.headers.get(name) ?? undefined
    },
    getHeaders () {
      const headers: Record<string, string | string[]> = Object.fromEntries(event.res.headers.entries())
      const cookies = event.res.headers.getSetCookie()
      if (cookies.length > 0) {
        headers['set-cookie'] = cookies
      }
      return headers
    },
    hasHeader (name: string) {
      return event.res.headers.has(name)
    },
    removeHeader (name: string) {
      event.res.headers.delete(name)
    },
    writeHead (status: number, arg1?: string | Record<string, string | string[] | number>, arg2?: Record<string, string | string[] | number>) {
      event.res.status = status
      if (typeof arg1 === 'string') {
        event.res.statusText = arg1
      }
      const headers = typeof arg1 === 'string' ? arg2 : arg1
      for (const [name, value] of Object.entries(headers || {})) {
        replaceHeader(event, name, value)
      }
      return this
    },
  }
}
