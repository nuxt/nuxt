import type { ServerResponse } from 'node:http'
import { H3Event, HTTPResponse } from 'nitro/h3'
import { useRequest } from 'nitro/context'
import type { H3Event as H3EventType } from 'nitro/h3'

import { endResponse, isResponseEnded, takeEndedResponse } from './ended-response.ts'

export type RouteRulesResolver = (event: H3EventType) => Record<string, any>

const kEvent = Symbol.for('nuxt.compat.event')

const legacyRoutes = new WeakMap<object, Record<string, any>>()
const legacyRouteHandler: ProxyHandler<Record<string, any>> = {
  get: (target, key) => key === 'path' ? target.route : Reflect.get(target, key),
  has: (target, key) => key === 'path' || Reflect.has(target, key),
  ownKeys: target => [...Reflect.ownKeys(target), 'path'],
  getOwnPropertyDescriptor: (target, key) => key === 'path'
    ? { value: target.route, writable: true, enumerable: true, configurable: true }
    : Reflect.getOwnPropertyDescriptor(target, key),
}

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
 * populated from `getRouteRules(event)`, `event.context.matchedRoute.path`, and an
 * `event.node` whose response forwards header and status writes onto the web response.
 */
export function prepareLegacyEvent (event: H3EventType, getRouteRules?: RouteRulesResolver): H3EventType {
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
      get: () => (slot ||= createLegacyNitroSlot(event, getRouteRules)),
      set: (value: Record<string, any>) => { slot = value },
    })
  }

  // h3 v2 names the matched pattern `route` where v1 named it `path`
  const matched = context.matchedRoute
  if (matched && matched.path === undefined && typeof matched.route === 'string') {
    // h3 shares the route data across requests, so writing `path` onto it would show it to v3 handlers too
    let legacy = legacyRoutes.get(matched)
    if (!legacy) {
      legacy = new Proxy<Record<string, any>>(matched, legacyRouteHandler)
      legacyRoutes.set(matched, legacy)
    }
    context.matchedRoute = legacy
  }

  // each v1 handler prepares the event again, and must see the response a request hook wrapped
  if (Object.hasOwn(event, 'node')) {
    return event
  }

  const node = event.req.runtime?.node
  if (node) {
    // a websocket upgrade carries a node request without a response
    const res = node.res as ServerResponse | undefined
    let bridge: { req: unknown, res: unknown } | undefined
    Object.defineProperty(event, 'node', {
      configurable: true,
      get: () => (bridge ||= { ...node, res: res ? bridgeNodeResponse(event, res) : createNodeResponseBridge(event) }),
    })
  } else {
    const originalUrl = event.url.pathname + event.url.search
    let bridge: { req: unknown, res: unknown } | undefined
    Object.defineProperty(event, 'node', {
      configurable: true,
      get: () => (bridge ||= {
        req: createNodeRequestBridge(event, originalUrl),
        res: createNodeResponseBridge(event),
      }),
    })
  }

  return event
}

/**
 * Send what a v1 handler returns as h3 v1 did: a string as HTML unless the handler set a content
 * type, and `null` as an empty response, with `204 No Content` unless the handler set a status.
 * A response a v1 helper ended the request with takes the place of the returned value.
 */
export function fromLegacyBody<T> (event: H3EventType, returned: T): T | HTTPResponse {
  const ended = takeEndedResponse(event)
  const body = (ended === undefined ? returned : ended) as T
  if (body === null) {
    const status = event.res.status
    return new HTTPResponse(null, { status: status && status !== 200 ? status : 204 })
  }
  if (typeof body === 'string' && event.res.status !== 304 && !event.res.headers.has('content-type')) {
    event.res.headers.set('content-type', 'text/html')
  }
  return body
}

function createLegacyNitroSlot (event: H3EventType, getRouteRules?: RouteRulesResolver) {
  const slot: Record<string, any> = {}
  let rules: Record<string, any> | undefined
  Object.defineProperty(slot, 'routeRules', {
    configurable: true,
    enumerable: true,
    get: () => (rules ||= getRouteRules?.(event) ?? event.context.routeRules ?? {}),
    set: (value: Record<string, any>) => { rules = value },
  })
  return slot
}

function createNodeRequestBridge (event: H3EventType, originalUrl: string) {
  const socket = createSocketBridge(event)
  return {
    // the path as the handler sees it, which a mounted handler sees with its base stripped
    get url () {
      return event.url.pathname + event.url.search
    },
    method: event.req.method,
    // a live view, as it would be on a real node request
    get headers () {
      const headers: Record<string, string> = {}
      for (const [key, value] of event.req.headers) {
        headers[key] = value
      }
      return headers
    },
    originalUrl,
    socket,
    connection: socket,
  }
}

/**
 * The socket of a request that reached the app without one, such as a request made in
 * process. Its `readyState` is `readOnly`, which is how v1 code tells such a request apart.
 */
function createSocketBridge (event: H3EventType) {
  const socket = {
    readyState: 'readOnly',
    destroyed: false,
    get remoteAddress () {
      return event.req.ip
    },
    get encrypted () {
      return event.url.protocol === 'https:'
    },
    setTimeout: () => socket,
    setNoDelay: () => socket,
    setKeepAlive: () => socket,
  }
  return socket
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

const NODE_RESPONSE_WRITERS = new Set<string | symbol>(['writeHead', 'write', 'end', 'flushHeaders'])

/**
 * A node response whose header and status writes also apply to the web response, and which
 * takes the status and headers of the web response when a handler writes to it directly.
 */
function bridgeNodeResponse (event: H3EventType, res: ServerResponse): ServerResponse {
  const web = createNodeResponseBridge(event)

  function flush () {
    if (res.headersSent) { return }
    if (event.res.status) { res.statusCode = event.res.status }
    if (event.res.statusText) { res.statusMessage = event.res.statusText }
    for (const [name, value] of Object.entries(web.getHeaders())) {
      res.setHeader(name, value)
    }
  }

  const headers: Record<string | symbol, (...args: any[]) => unknown> = {
    setHeader (name: string, value: string | string[]) {
      res.setHeader(name, value)
      web.setHeader(name, value)
      return proxy
    },
    appendHeader (name: string, value: string | string[]) {
      const existing = res.getHeader(name)
      if (existing !== undefined && !web.hasHeader(name)) {
        web.setHeader(name, existing as string | string[])
      }
      res.appendHeader(name, value)
      web.appendHeader(name, value)
      return proxy
    },
    setHeaders (entries: Headers | Map<string, string | string[] | number>) {
      res.setHeaders(entries)
      const cookies: string[] = []
      for (const [name, value] of entries) {
        if (name.toLowerCase() === 'set-cookie') {
          cookies.push(...(Array.isArray(value) ? value : [String(value)]))
        } else {
          web.setHeader(name, value as string | string[])
        }
      }
      if (cookies.length > 0) { web.setHeader('set-cookie', cookies) }
      return proxy
    },
    getHeader: (name: string) => web.getHeader(name) ?? res.getHeader(name),
    getHeaders: () => ({ ...res.getHeaders(), ...web.getHeaders() }),
    getHeaderNames: () => Object.keys({ ...res.getHeaders(), ...web.getHeaders() }),
    hasHeader: (name: string) => web.hasHeader(name) || res.hasHeader(name),
    removeHeader (name: string) {
      web.removeHeader(name)
      res.removeHeader(name)
    },
  }

  const proxy: ServerResponse = new Proxy(res, {
    get (target, prop) {
      if (!target.headersSent) {
        if (prop === 'statusCode') { return event.res.status ?? target.statusCode }
        if (prop === 'statusMessage') { return event.res.statusText ?? target.statusMessage }
        if (Object.hasOwn(headers, prop)) { return headers[prop] }
      }
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function' || prop === 'constructor') { return value }
      const writes = NODE_RESPONSE_WRITERS.has(prop)
      return (...args: unknown[]) => {
        if (writes) { flush() }
        const result = value.apply(target, args)
        return result === target ? proxy : result
      }
    },
    set (target, prop, value) {
      if (!target.headersSent) {
        if (prop === 'statusCode') { event.res.status = value }
        if (prop === 'statusMessage') { event.res.statusText = value }
      }
      return Reflect.set(target, prop, value, target)
    },
  })
  return proxy
}

function createNodeResponseBridge (event: H3EventType) {
  const chunks: Buffer[] = []
  let sent = false

  function push (chunk: unknown, encoding: unknown): void {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk, encoding as BufferEncoding))
    } else if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk))
    }
  }

  return {
    write (chunk: unknown, encoding?: unknown, callback?: unknown) {
      sent = true
      if (!isResponseEnded(event)) {
        push(chunk, encoding)
      }
      const done = typeof encoding === 'function' ? encoding : callback
      if (typeof done === 'function') {
        queueMicrotask(done as () => void)
      }
      return true
    },
    end (chunk?: unknown, encoding?: unknown, callback?: unknown) {
      if (!isResponseEnded(event)) {
        push(chunk, encoding)
        endResponse(event, Buffer.concat(chunks))
      }
      const done = [chunk, encoding, callback].find(arg => typeof arg === 'function')
      if (done) {
        queueMicrotask(done as () => void)
      }
      return this
    },
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
      return sent || isResponseEnded(event)
    },
    get writableEnded () {
      return isResponseEnded(event)
    },
    get finished () {
      return isResponseEnded(event)
    },
    setHeader (name: string, value: string | string[]) {
      replaceHeader(event, name, value)
      return this
    },
    appendHeader (name: string, value: string | string[]) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        event.res.headers.append(name, entry)
      }
      return this
    },
    getHeader (name: string) {
      // node returns repeated `set-cookie` values as an array, where `Headers.get` joins them
      if (name.toLowerCase() === 'set-cookie') {
        const cookies = event.res.headers.getSetCookie()
        return cookies.length > 0 ? cookies : undefined
      }
      return event.res.headers.get(name) ?? undefined
    },
    getHeaders () {
      // node returns repeated `set-cookie` values as an array, where iterating a `Headers`
      // yields one entry per cookie and so keeps only the last of them
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
      sent = true
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
