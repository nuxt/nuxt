import { useNuxtApp } from '../nuxt'
export function getUniqueID(): string
export function getUniqueID (...args: any): string {
  const key = args[0]
  if (typeof key !== 'string') {
    throw new TypeError(`[nuxt] [getUniqueID] key must be a string: ${key}}`)
  }

  const nuxt = useNuxtApp()
  const localId = (nuxt.payload?._ids?.[key] ?? 0) + 1
  nuxt.payload._ids = nuxt.payload._ids ?? {}
  nuxt.payload._ids[key] = localId

  return key + ':' + localId.toString(32)
}
