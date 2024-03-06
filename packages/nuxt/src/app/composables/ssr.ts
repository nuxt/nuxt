import type { H3Event } from 'h3'
import { setResponseStatus as _setResponseStatus, appendHeader, getRequestHeader, getRequestHeaders } from 'h3'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'
import { toArray } from '../utils'

/** @since 3.0.0 */
export function useRequestEvent (nuxtApp: NuxtApp = useNuxtApp()) {
  return nuxtApp.ssrContext?.event
}

/** @since 3.0.0 */
export function useRequestHeaders<K extends string = string> (include: K[]): { [key in Lowercase<K>]?: string }
export function useRequestHeaders (): Readonly<Record<string, string>>
export function useRequestHeaders (include?: any[]) {
  if (import.meta.client) { return {} }
  const event = useRequestEvent()
  const _headers = event ? getRequestHeaders(event) : {}
  if (!include || !event) { return _headers }
  const headers = Object.create(null)
  for (const _key of include) {
    const key = _key.toLowerCase()
    const header = _headers[key]
    if (header) {
      headers[key] = header
    }
  }
  return headers
}

/** @since 3.9.0 */
export function useRequestHeader (header: string) {
  if (import.meta.client) { return undefined }
  const event = useRequestEvent()
  return event ? getRequestHeader(event, header) : undefined
}

/** @since 3.2.0 */
export function useRequestFetch (): typeof global.$fetch {
  if (import.meta.client) {
    return globalThis.$fetch
  }
  return useRequestEvent()?.$fetch as typeof globalThis.$fetch || globalThis.$fetch
}

/** @since 3.0.0 */
export function setResponseStatus (event: H3Event, code?: number, message?: string): void
/** @deprecated Pass `event` as first option. */
export function setResponseStatus (code: number, message?: string): void
export function setResponseStatus (arg1: H3Event | number | undefined, arg2?: number | string, arg3?: string) {
  if (import.meta.client) { return }
  if (arg1 && typeof arg1 !== 'number') {
    return _setResponseStatus(arg1, arg2 as number | undefined, arg3)
  }
  const event = useRequestEvent()
  if (event) {
    return _setResponseStatus(event, arg1, arg2 as string | undefined)
  }
}

/** @since 3.8.0 */
export function prerenderRoutes (path: string | string[]) {
  if (!import.meta.server || !import.meta.prerender) { return }

  const paths = toArray(path)
  appendHeader(useRequestEvent()!, 'x-nitro-prerender', paths.map(p => encodeURIComponent(p)).join(', '))
}
