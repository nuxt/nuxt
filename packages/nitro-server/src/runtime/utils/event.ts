import { getRequestHost, getRequestProtocol, toWebRequest } from 'h3'
import type { H3Event } from 'h3'
import type { RendererEvent } from 'nuxt/internal/renderer/runtime'

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

/** The h3 v1 event a renderer event was built from. */
export function getH3Event (event: RendererEvent): H3Event {
  return (event['~app'] ?? event) as unknown as H3Event
}

/**
 * Describe an h3 v1 event in the web-standard shape the SSR renderer reads.
 *
 * The event is described rather than adapted in place because `event.req` and `event.res`
 * already name the node request and response on an h3 v1 event, and that is the shape
 * `useRequestEvent()` and the render hooks must keep seeing; the renderer is handed this
 * view and reaches the event itself through `app`.
 *
 * Everything is resolved on access, and the response is backed by the node response rather
 * than a copy of it, so a header the application sets through h3 and a header the renderer
 * sets are the same header.
 */
export function toRequestEvent (event: H3Event): RendererEvent {
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
  // a request nitro made to itself may reach the internal error route
  if ('__unenv__' in node.req) {
    const context = event.context as { nuxt?: { '~internal'?: boolean } }
    context.nuxt ||= {}
    context.nuxt['~internal'] = true
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

  // read only by `appEvent()`, which is how the renderer hands the application and the
  // render hooks the event this runtime gave it rather than this view of it
  requestEvent['~app'] = event as unknown as RendererEvent['~app']

  return requestEvent
}
