/**
 * The URL of the current document, or the base URL it inherits when its own location is
 * opaque, as in an `<iframe srcdoc>`.
 * @internal
 */
export function documentURL (): URL {
  return new URL(window.location.origin === 'null' ? document.baseURI : window.location.href)
}
