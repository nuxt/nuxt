/* eslint-disable no-redeclare */
import type { CompatibilityEvent } from 'h3'
import { useNuxtApp } from '#app'
import { NuxtApp } from '#app/nuxt'

export function useRequestHeaders<K extends string = string> (include: K[]): Record<K, string | undefined>
export function useRequestHeaders (): Readonly<Record<string, string | undefined>>
export function useRequestHeaders (include?) {
  if (process.client) { return {} }
  const headers: Record<string, string | string[]> = useNuxtApp().ssrContext?.event.req.headers ?? {}
  if (!include) { return headers }
  return Object.fromEntries(include.filter(key => headers[key]).map(key => [key, headers[key]]))
}

export function useRequestEvent (nuxtApp: NuxtApp = useNuxtApp()): CompatibilityEvent {
  return nuxtApp.ssrContext?.event as CompatibilityEvent
}
