import { appPayloadFileName } from 'nuxt/internal/renderer-config'

/**
 * The fragment of a request URL, avoiding the lazy URL parse that reading `hash` triggers when
 * there is none. A fragment is never sent over the wire, so it can only appear on a URL the
 * server constructed itself.
 */
export function urlHash (url: URL): string {
  return url.href.includes('#') ? url.hash : ''
}

export function toEncodedPathname (path: string): string {
  try {
    return new URL('./' + path.replace(/^\/+/, ''), 'http://localhost/').pathname
  } catch {
    return path.startsWith('/') ? path : `/${path}`
  }
}

/** Whether a request pathname matches `errorRoute` exactly or beneath a `/` boundary. */
export function isErrorRoutePath (pathname: string, errorRoute: string): boolean {
  return pathname === errorRoute || (errorRoute !== '/' && pathname.startsWith(`${errorRoute}/`))
}

export const PAYLOAD_FILENAME = appPayloadFileName || '_payload.json'
export const ENCODED_PAYLOAD_FILENAME = toEncodedPathname(PAYLOAD_FILENAME).slice(1)
export const PAYLOAD_BUILD_ID_PARAM = '_b'

/** Parse a request path without treating a leading `//` as an authority. */
export function parseRequestPath (path: string): URL {
  return new URL('http://localhost' + path)
}

/** The page route a `_payload.json` request renders, without the build id param. */
export function payloadRequestToRoute (path: string): string {
  const payloadURL = parseRequestPath(path)
  const url = payloadURL.pathname.slice(0, -`/${ENCODED_PAYLOAD_FILENAME}`.length) || '/'
  payloadURL.searchParams.delete(PAYLOAD_BUILD_ID_PARAM)
  return url + payloadURL.search
}

const LEADING_SLASHES_RE = /^\/+/

/** Strip every trailing `/` from a path. */
export function withoutTrailingSlashes (path: string): string {
  let end = path.length
  while (end > 0 && path[end - 1] === '/') {
    end--
  }
  return path.slice(0, end)
}

/** The same-origin `_payload.json` URL for a page route, tagged with the build id if one is given. */
export function routeToPayloadURL (baseURL: string, path: string, buildId?: string): string {
  const request = parseRequestPath(path)
  const base = new URL(withoutTrailingSlashes(baseURL) + '/', 'http://localhost')
  const route = withoutTrailingSlashes(request.pathname.replace(LEADING_SLASHES_RE, '')) + '/'
  const url = new URL('./' + (route === '/' ? '' : route) + PAYLOAD_FILENAME, base)
  url.search = request.search
  if (buildId) {
    url.searchParams.set(PAYLOAD_BUILD_ID_PARAM, buildId)
  }
  return URL.canParse(baseURL) ? url.href : url.pathname + url.search
}
