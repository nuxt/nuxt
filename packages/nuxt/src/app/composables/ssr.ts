
import type { H3Event } from 'h3'
import { setResponseStatus as _setResponseStatus } from 'h3'
import type { NuxtApp } from '../nuxt'
import { useNuxtApp } from '../nuxt'

export function useRequestHeaders<K extends string = string> (include: K[]): Record<Lowercase<K>, string | undefined>
export function useRequestHeaders (): Readonly<Record<string, string | undefined>>
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

export function setResponseStatus (code: number, message?: string) {
  if (process.client) { return }
  _setResponseStatus(useRequestEvent(), code, message)
}
