import { getRequestURL } from 'h3'
import { useRequestEvent } from './ssr'

/** @since 3.5.0 */
export function useRequestURL (opts?: {
  xForwardedHost?: boolean
  xForwardedProto?: boolean
}) {
  if (import.meta.server) {
    return getRequestURL(useRequestEvent()!, opts)
  }
  return new URL(window.location.href)
}
