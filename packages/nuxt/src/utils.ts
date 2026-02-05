import { promises as fsp, statSync } from 'node:fs'
import { tryUseNuxt, useLogger } from '@nuxt/kit'
import { reverseResolveAlias } from 'pathe/utils'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export async function isDirectory (path: string) {
  return (await fsp.lstat(path)).isDirectory()
}

export function isDirectorySync (path: string) {
  try { return statSync(path).isDirectory() } catch { return false }
}

export function stripExtension (path: string) {
  return path.replace(/\.[^./\\]+$/, '')
}

export function isWhitespace (char: number | string | undefined | null): boolean {
  const c = typeof char === 'string' ? char.charCodeAt(0) : char
  // ' ' (32), '\t' (9), '\n' (10), '\r' (13), '\f' (12)
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 12
}

export const DECLARATION_EXTENSIONS = ['d.ts', 'd.mts', 'd.cts', 'd.vue.ts', 'd.vue.mts', 'd.vue.cts']

export const logger = useLogger('nuxt')

export function resolveToAlias (path: string, nuxt = tryUseNuxt()) {
  return reverseResolveAlias(path, { ...nuxt?.options.alias || {}, ...strippedAtAliases }).pop() || path
}

const strippedAtAliases = {
  '@': '',
  '@@': '',
}
