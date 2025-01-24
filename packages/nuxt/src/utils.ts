import { promises as fsp } from 'node:fs'
import { useLogger } from '@nuxt/kit'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export async function isDirectory (path: string) {
  return (await fsp.lstat(path)).isDirectory()
}

export const ROUTE_KEY_PARENTHESES_RE = /(:\w+)\([^)]+\)/g
export const ROUTE_KEY_SYMBOLS_RE = /(:\w+)[?+*]/g
export const ROUTE_KEY_NORMAL_RE = /:\w+/g

export const logger = useLogger('nuxt')
