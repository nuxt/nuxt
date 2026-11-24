import { withoutTrailingSlash } from 'ufo'

/**
 * The prefix `baseURL` puts on request paths. A relative base is resolved in the browser and
 * never reaches a request path, so it has none.
 */
function basePrefix (baseURL: string): string {
  const base = withoutTrailingSlash(baseURL)
  return base[0] === '/' && base !== '/' ? base : ''
}

/** The request URL relative to `baseURL`, or `undefined` for a URL outside it. */
export function withoutBaseURL (url: URL, baseURL: string): URL | undefined {
  const base = basePrefix(baseURL)
  if (!base) {
    return url
  }
  if (url.pathname !== base && !url.pathname.startsWith(base + '/')) {
    return
  }
  const relative = new URL(url)
  relative.pathname = url.pathname.slice(base.length) || '/'
  return relative
}

/** Prefix a path relative to `baseURL` so it addresses the request path it was read from. */
export function withBaseURL (path: string, baseURL: string): string {
  return basePrefix(baseURL) + path
}
