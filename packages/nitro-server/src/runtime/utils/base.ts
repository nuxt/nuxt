import { H3Event } from 'nitro/h3'
import type { ServerRequest } from 'srvx'
import { withoutTrailingSlash } from 'ufo'
import { urlHash } from 'nuxt/renderer/url'

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
 * Copy a request URL with `base` removed from its path.
 */
export function withoutBaseURL (url: URL, base: string): URL {
  const href = url.href
  const path = (url.pathname.slice(base.length) || '/') + url.search + urlHash(url)
  const protocolEnd = href.indexOf('://')
  const originEnd = protocolEnd === -1 ? -1 : href.indexOf('/', protocolEnd + 3)

  // Taking the origin from `href` keeps this to a single parse
  return originEnd === -1
    ? new URL(path, url.origin)
    : new URL(href.slice(0, originEnd) + path)
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

  event.url = withoutBaseURL(event.url, BASE_URL)

  return event
}

/** Prefix a base-relative path so it addresses the route nitro registered for it. */
export function withBaseURL (path: string): string {
  return BASE_URL + path
}
