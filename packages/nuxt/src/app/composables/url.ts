import { getRequestURL } from 'h3'
import { useRequestEvent } from './ssr'

/** @since 3.5.0 */
export function useRequestURL (opts?: Parameters<typeof getRequestURL>[1]) {
  if (import.meta.server) {
    return getRequestURL(useRequestEvent()!, opts)
  }
  // we use globalThis to avoid crashes in web workers
  return new URL(globalThis.location.href)
}
