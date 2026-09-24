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
