import { getRequestHost, getRequestProtocol, getRequestURL, readRawBody } from 'h3'
import type { H3Event } from 'h3'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'
import type { NuxtRequestContext, RequestEvent } from 'nuxt/schema'

const ENC_PIPE_RE = /%7C/g
const ENC_BRACKET_OPEN_RE = /%5B/g
const ENC_BRACKET_CLOSE_RE = /%5D/g
const ENC_ENC_SLASH_RE = /%252F/gi
const HASH_RE = /#/g
const QUESTION_MARK_RE = /\?/g

// h3 decodes the path, apart from `%2F`, and vue-router expects an encoded path
function encodeEventPath (path: string): string {
  const queryIndex = path.indexOf('?')
  if (queryIndex === -1) { return encodeVueRouterPath(path) }
  return encodeVueRouterPath(path.slice(0, queryIndex)) + path.slice(queryIndex)
}

// Kept in sync with `unrouting`, which encodes the static segments of route records with the
// same steps. The inputs differ, though: unrouting encodes a filename token, where `%` is a
// literal character, while this encodes an already-decoded URL path, where `%25` means an
// encoded percent. They agree on `&`, `+`, `[`, `]` and `%2F`, and diverge on `%25`, so a page
// file with a literal `%` in its name does not round-trip: h3 v1 decodes requests for both
// `/100%25` and `/100%2525` to the same `event.path`, so the two cannot be told apart here.
function encodeVueRouterPath (path: string): string {
  return encodeURI(path)
    .replace(ENC_PIPE_RE, '|')
    .replace(ENC_BRACKET_OPEN_RE, '[')
    .replace(ENC_BRACKET_CLOSE_RE, ']')
    .replace(HASH_RE, '%23')
    .replace(QUESTION_MARK_RE, '%3F')
    .replace(ENC_ENC_SLASH_RE, '%2F')
}

/**
 * The response headers of an h3 v1 event, in the shape the renderer writes them in.
 *
 * Backed by the node response rather than a copy of it, so a header the app sets through
 * h3 and a header the renderer sets are the same header, and both are sent.
 */
class NodeResponseHeaders {
  constructor (private res: H3Event['node']['res']) {}

  get (name: string): string | null {
    const value = this.res.getHeader(name)
    if (value === undefined) { return null }
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  has (name: string): boolean {
    return this.res.hasHeader(name)
  }

  set (name: string, value: string): void {
    this.res.setHeader(name, value)
  }

  append (name: string, value: string): void {
    const existing = this.res.getHeader(name)
    if (existing === undefined) {
      this.res.setHeader(name, value)
      return
    }
    this.res.setHeader(name, Array.isArray(existing) ? [...existing, value] : [String(existing), value])
  }

  delete (name: string): void {
    this.res.removeHeader(name)
  }

  * entries (): IterableIterator<[string, string]> {
    for (const [name, value] of Object.entries(this.res.getHeaders())) {
      if (value === undefined) { continue }
      if (Array.isArray(value)) {
        for (const entry of value) {
          yield [name, entry]
        }
      } else {
        yield [name, String(value)]
      }
    }
  }

  [Symbol.iterator] (): IterableIterator<[string, string]> {
    return this.entries()
  }
}

const WEB_PROPERTIES = new Set(['req', 'res', 'url', '~app'])

const PAYLOAD_METHODS = new Set(['PATCH', 'POST', 'PUT', 'DELETE'])

/**
 * The request in the web-standard shape, with its body read through h3 v1's own reader.
 *
 * h3 caches the bytes it reads on the node request, so a body read here and a
 * `readBody(event)` elsewhere in the same request resolve to the same bytes whichever
 * happens first, rather than the second read finding a stream the first has drained.
 *
 * `clone()` builds a request the same way, so it succeeds even once the body of the request
 * it was cloned from has been read.
 */
function toWebRequest (event: H3Event): Request {
  const existing = (event as { web?: { request?: Request } }).web?.request
  if (existing) {
    return existing
  }

  const method = event.method
  const request = new Request(getRequestURL(event), {
    method,
    headers: event.headers,
    body: PAYLOAD_METHODS.has(method) ? toBufferedBodyStream(event) : undefined,
    // @ts-expect-error undici option, required to send a stream body
    duplex: 'half',
  })

  Object.defineProperty(request, 'clone', { value: () => toWebRequest(event), configurable: true, writable: true })

  return request
}

function toBufferedBodyStream (event: H3Event): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async pull (controller) {
      const body = await readRawBody(event, false)
      if (body) {
        controller.enqueue(new Uint8Array(body))
      }
      controller.close()
    },
  })
}

const portableEvents = new WeakMap<H3Event, RequestEvent>()

/**
 * The event a `nuxt/server` handler is given, in the web-standard shape.
 *
 * Both shapes are served from one object: `req`, `res`, `url` and `~app` resolve to the web
 * view, everything else to the h3 v1 event, so h3's own helpers work on it too (they read
 * `event.node`, not its deprecated `req`/`res` aliases). Cached per event.
 */
export function toPortableEvent (event: H3Event): RequestEvent {
  const cached = portableEvents.get(event)
  if (cached) { return cached }

  const web = toWebView(event)
  const portable = new Proxy(event, {
    get (target, property) {
      return WEB_PROPERTIES.has(property as string)
        ? web[property as keyof RendererEvent]
        : Reflect.get(target, property, target)
    },
    set (target, property, value) {
      if (property === 'url') {
        web.url = value
        return true
      }
      return Reflect.set(target, property, value, target)
    },
    has (target, property) {
      return WEB_PROPERTIES.has(property as string) || Reflect.has(target, property)
    },
  }) as unknown as RequestEvent

  portableEvents.set(event, portable)

  return portable
}

/**
 * The Nuxt context a request nitro made to itself was fetched with: `node-mock-http` carries
 * it on the mock request rather than in the h3 event's own context. A request that arrives
 * over the network has none, whoever sent it.
 */
export function getFetchedRequestContext (event: H3Event): NuxtRequestContext | undefined {
  return (event.node.req as { __unenv__?: { nuxt?: NuxtRequestContext } }).__unenv__?.nuxt
}

/** The event the SSR renderer reads, which reaches the h3 v1 event itself through `~app`. */
export function toRequestEvent (event: H3Event): RendererEvent {
  const requestEvent = toWebView(event)

  const fetchedWith = getFetchedRequestContext(event)
  if (fetchedWith) {
    event.context.nuxt = { ...fetchedWith, ...event.context.nuxt }
  }

  return requestEvent
}

/**
 * Describe an h3 v1 event in the web-standard shape, rather than adapting it in place:
 * `event.req` and `event.res` already name the node request and response, and that is the
 * shape `useRequestEvent()` and the render hooks must keep seeing.
 *
 * Everything is resolved on access, and the response is backed by the node response rather
 * than a copy of it, so a header the application sets through h3 and a header the renderer
 * sets are the same header.
 */
function toWebView (event: H3Event): RendererEvent {
  const node = event.node
  let request: Request | undefined
  let url: URL | undefined
  const res = {
    get status () {
      return node.res.statusCode
    },
    set status (status: number) {
      node.res.statusCode = status
    },
    get statusText () {
      return node.res.statusMessage
    },
    set statusText (statusText: string) {
      node.res.statusMessage = statusText
    },
    headers: new NodeResponseHeaders(node.res) as unknown as Headers,
  }
  const requestEvent = {
    context: event.context,
    res,
    get req () {
      return (request ??= toWebRequest(event))
    },
    get url () {
      return (url ??= new URL(encodeEventPath(event.path), `${getRequestProtocol(event)}://${getRequestHost(event)}`))
    },
    // the renderer rewrites the URL when a payload request renders the page it belongs to
    set url (value: URL) {
      url = value
      event._path = node.req.url = value.pathname + value.search
    },
  } as RendererEvent

  // read through `appEvent()`, which is how the renderer passes the application and the
  // render hooks the event this runtime gave it rather than this view of it
  requestEvent['~app'] = event as unknown as RendererEvent['~app']

  return requestEvent
}
