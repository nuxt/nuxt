/* eslint-disable no-redeclare */
import type { H3Event } from 'h3'
import { useNuxtApp, NuxtApp } from '../nuxt'

export function useRequestHeaders<K extends string = string> (include: K[]): Record<K, string | undefined>
export function useRequestHeaders (): Readonly<Record<string, string | undefined>>
export function useRequestHeaders (include?: any[]) {
  if (process.client) { return {} }
  const headers = useNuxtApp().ssrContext?.event.req.headers ?? {}
  if (!include) { return headers }
  return Object.fromEntries(include.filter(key => headers[key]).map(key => [key, headers[key]]))
}

export function useRequestEvent (nuxtApp: NuxtApp = useNuxtApp()): H3Event {
  return nuxtApp.ssrContext?.event as H3Event
}

export function setResponseStatus (code: number, message?: string) {
  const event = process.server && useRequestEvent()
  if (event) {
    event.res.statusCode = code
    if (message) {
      event.res.statusMessage = message
    }
  }
}
