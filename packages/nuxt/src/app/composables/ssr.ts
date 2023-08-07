import type { H3Event } from 'h3'
import { setResponseStatus as _setResponseStatus } from 'h3'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'

export function useRequestHeaders<K extends string = string> (include: K[]): { [key in Lowercase<K>]?: string }
export function useRequestHeaders (): Readonly<Record<string, string>>
export function useRequestHeaders (include?: any[]) {
  if (process.client) { return {} }
  const headers = useNuxtApp().ssrContext?.event.node.req.headers ?? {}
  if (!include) { return headers }
  return Object.fromEntries(include.map(key => key.toLowerCase()).filter(key => headers[key]).map(key => [key, headers[key]]))
}

export function useRequestEvent (nuxtApp: NuxtApp = useNuxtApp()): H3Event {
  return nuxtApp.ssrContext?.event as H3Event
}

export function useRequestFetch (): typeof global.$fetch {
  if (process.client) {
    return globalThis.$fetch
  }
  const event = useNuxtApp().ssrContext?.event as H3Event
  return event?.$fetch as typeof globalThis.$fetch || globalThis.$fetch
}

export function setResponseStatus (event: H3Event, code?: number, message?: string): void
/** @deprecated Pass `event` as first option. */
export function setResponseStatus (code: number, message?: string): void
export function setResponseStatus (arg1: H3Event | number | undefined, arg2?: number | string, arg3?: string) {
  if (process.client) { return }
  if (arg1 && typeof arg1 !== 'number') {
    return _setResponseStatus(arg1, arg2 as number | undefined, arg3)
  }
  return _setResponseStatus(useRequestEvent(), arg1, arg2 as string | undefined)
}
