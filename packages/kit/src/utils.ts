import { AsyncLocalStorage } from 'node:async_hooks'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export const MODE_RE = /\.(server|client)(\.\w+)*$/
/**
 * async local storage for the name of the current nuxt instance
 * @internal
 */
export const asyncNameStorage = new AsyncLocalStorage<string>()
