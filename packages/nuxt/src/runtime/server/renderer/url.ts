/**
 * The fragment of a request URL, avoiding the lazy URL parse that reading `hash` triggers when
 * there is none. A fragment is never sent over the wire, so it can only appear on a URL the
 * server constructed itself.
 */
export function urlHash (url: URL): string {
  return url.href.includes('#') ? url.hash : ''
}

export const PAYLOAD_FILENAME = '_payload.json'
export const PAYLOAD_BUILD_ID_PARAM = '_b'

/** Parse a request path without treating a leading `//` as an authority. */
export function parseRequestPath (path: string): URL {
  return new URL('http://localhost' + path)
}

/** The page route a `_payload.json` request renders, without the build id param. */
export function payloadRequestToRoute (path: string): string {
  const payloadURL = parseRequestPath(path)
  const url = payloadURL.pathname.slice(0, -`/${PAYLOAD_FILENAME}`.length) || '/'
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

/** The same-origin `_payload.json` URL for a page route, tagged with the build id. */
export function routeToPayloadURL (baseURL: string, path: string, buildId: string): string {
  const request = parseRequestPath(path)
  const base = new URL(withoutTrailingSlashes(baseURL) + '/', 'http://localhost')
  const route = withoutTrailingSlashes(request.pathname.replace(LEADING_SLASHES_RE, '')) + '/'
  const url = new URL('./' + (route === '/' ? '' : route) + PAYLOAD_FILENAME, base)
  url.search = request.search
  url.searchParams.set(PAYLOAD_BUILD_ID_PARAM, buildId)
  return URL.canParse(baseURL) ? url.href : url.pathname + url.search
}
