import { getRequestURL } from 'h3'
import { useRequestEvent } from './ssr'

/** @since 3.5.0 */
export function useRequestURL () {
  if (import.meta.server) {
    return getRequestURL(useRequestEvent()!)
  }
  return new URL(window.location.href)
}
