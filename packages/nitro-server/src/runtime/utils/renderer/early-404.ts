import { createError, getRequestURL, setResponseHeader } from 'h3'
import type { H3Event } from 'h3'

import { NUXT_PAGE_MATCHER } from '#internal/nuxt/nitro-config.mjs'

const TRAILING_SLASHES_RE = /\/+$/
const PAYLOAD_SUFFIX = '/_payload.json'

/**
 * Whether a request path could match a page route, using the matcher compiled
 * at build time. The lookup is deliberately looser than vue-router matching
 * (decoded, case-folded, trailing slashes ignored, payload URLs matched
 * against the route they belong to) so that a miss is proof no page can
 * render, while a hit merely lets the request through to the app.
 */
function matchesPageRoute (pathname: string): boolean {
  let path = pathname
  if (path.endsWith(PAYLOAD_SUFFIX)) {
    path = path.slice(0, -PAYLOAD_SUFFIX.length) || '/'
  }
  if (path.length > 1) {
    path = path.replace(TRAILING_SLASHES_RE, '') || '/'
  }
  if (path.includes('%')) {
    try {
      path = decodeURI(path)
    } catch {
      // matched in encoded form
    }
  }
  return !!NUXT_PAGE_MATCHER?.('', path.toLowerCase())
}

/**
 * Throw a 404 error for paths that cannot match any page route, so the app
 * (and its plugins and middleware) is never loaded for them.
 *
 * When a `cache` route rule covers the path, its `maxAge` is advertised on
 * GET/HEAD misses too, so CDNs can absorb repeat probes for unknown paths.
 */
export function throwIfUnmatchedPagePath (event: H3Event, routeOptions: { cache?: { maxAge?: number } | false }): void {
  const url = getRequestURL(event)
  if (matchesPageRoute(url.pathname)) {
    return
  }
  const path = url.pathname + url.search
  const maxAge = routeOptions.cache ? routeOptions.cache.maxAge : undefined
  const cacheable = !!maxAge && maxAge > 0 && (event.method === 'GET' || event.method === 'HEAD')
  if (cacheable) {
    setResponseHeader(event, 'cache-control', `public, max-age=${maxAge}`)
  }
  throw createError({
    statusCode: 404,
    statusMessage: `Page not found: ${path}`,
    data: { path },
  })
}
