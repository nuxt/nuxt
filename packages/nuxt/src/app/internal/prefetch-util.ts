// `navigator.connection` is not part of the standard TS DOM lib
interface NetworkInformationLike { saveData?: boolean, effectiveType?: string }
type NavigatorWithConnection = Navigator & { connection?: NetworkInformationLike }

const IS_2G_RE = /2g/

/**
 * Whether the connection can afford speculative work.
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
 * @internal
 */
export function canPrefetch (): boolean {
  if (import.meta.server) { return false }
  const connection = (navigator as NavigatorWithConnection).connection
  if (!connection) { return true }
  return !connection.saveData && !IS_2G_RE.test(connection.effectiveType || '')
}

/**
 * The destination a piece of prefetch work belongs to. The hash does not affect what is fetched.
 * @internal
 */
export function prefetchGroup (url: string): string {
  const { pathname, search } = new URL(url, window.location.href)
  return pathname + search
}
