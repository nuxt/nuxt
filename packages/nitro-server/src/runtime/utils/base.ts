import { H3Event } from 'nitro/h3'
import { FastURL } from 'srvx'
import type { ServerRequest } from 'srvx'
import { withoutTrailingSlash } from 'ufo'

/**
 * The base URL nitro registers its routes under, inlined at build time.
 *
 * A relative base (`./`) is resolved in the browser and never reaches a request path, and a base set
 * at runtime is handled by the `base-url` middleware instead, so in both cases this is empty.
 */
const BASE_URL = /* @__PURE__ */ (() => {
  const base = import.meta.baseURL
  return !base || base === '/' || /^\.(?:$|\/)/.test(base) ? '' : withoutTrailingSlash(base)
})()

const BASE_URL_PREFIX = BASE_URL + '/'

/**
 * `FastURL` also accepts the parts of an already-parsed URL, which is how `srvx` itself builds the
 * URL of an incoming request without paying for a parse, but its public types only declare the
 * `string | URL` constructor.
 */
const FastURLFromParts = FastURL as unknown as new (init: { protocol: string, host: string, pathname: string, search: string }) => URL

/**
 * The fragment of a request URL, without paying for it when there is none.
 *
 * `srvx` builds the URL of an incoming request from its parts, leaving `hash` to be resolved by
 * parsing the whole URL. That parse is wasted work: a fragment is never sent over the wire, so it
 * can only appear on a URL we constructed ourselves (an internal `serverFetch`), and in that case
 * it is present in `href`, which is always cheap to read.
 */
export function urlHash (url: URL): string {
  return url.href.includes('#') ? url.hash : ''
}

/**
 * Create the event for a Nuxt render, with the base URL removed from the request path.
 *
 * Nitro matches routes with the base URL still attached, whereas the app router, the page matcher
 * and payload URLs all work with paths relative to the base.
 */
export function createEvent (request: ServerRequest): H3Event {
  const event = new H3Event(request)
  if (!BASE_URL || (event.url.pathname !== BASE_URL && !event.url.pathname.startsWith(BASE_URL_PREFIX))) {
    return event
  }

  const url = event.url
  const href = url.href
  const pathname = url.pathname.slice(BASE_URL.length) || '/'
  const hash = urlHash(url)
  const protocolEnd = href.indexOf('://')
  const hostEnd = protocolEnd === -1 ? -1 : href.indexOf('/', protocolEnd + 3)

  event.url = hash || hostEnd === -1
    // `FastURL` holds no fragment, so fall back to a full parse for the URLs that carry one
    ? new URL(pathname + url.search + hash, url.origin)
    : new FastURLFromParts({
        protocol: href.slice(0, protocolEnd + 1),
        host: href.slice(protocolEnd + 3, hostEnd),
        pathname,
        search: url.search,
      })

  return event
}

/** Prefix a base-relative path so it addresses the route nitro registered for it. */
export function withBaseURL (path: string): string {
  return BASE_URL + path
}
