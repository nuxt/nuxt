/**
 * The fragment of a request URL, avoiding the lazy URL parse that reading `hash` triggers when
 * there is none. A fragment is never sent over the wire, so it can only appear on a URL the
 * server constructed itself.
 */
export function urlHash (url: URL): string {
  return url.href.includes('#') ? url.hash : ''
}
