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

const LEADING_DOT_RE = /^\.+/g

/**
 * Normalizes a file extension from a string to just the extension part (without the dot).
 * In case the string does not contain a dot, it returns the string as is.
 *
 * @example
 * normalizeExtension('.ts') // 'ts'
 * normalizeExtension('.d.ts') // 'd.ts'
 * normalizeExtension('ts') // 'ts'
 * normalizeExtension('d.ts') // 'ts'
 */
export function normalizeExtension (input: string) {
  return input.replace(LEADING_DOT_RE, '')
}

export function stripExtension (path: string) {
  return path.replace(/\.[^./\\]+$/, '')
}

export function isWhitespace (char: number | string | undefined | null): boolean {
  const c = typeof char === 'string' ? char.charCodeAt(0) : char
  // ' ' (32), '\t' (9), '\n' (10), '\r' (13), '\f' (12)
  return c === 32 || c === 9 || c === 10 || c === 13 || c === 12
}

export function isJavascriptExtension (path: string) {
  if (!path) { return false }
  return JS_EXTENSIONS.some(ext => path.endsWith(`.${ext}`))
}

export const JS_EXTENSIONS = ['js', 'ts', 'tsx', 'jsx', 'mjs', 'cjs', 'mts', 'cts']
export const DECLARATION_EXTENSIONS = ['d.ts', 'd.mts', 'd.cts']

export const logger = useLogger('nuxt')

export function resolveToAlias (path: string, nuxt = tryUseNuxt()) {
  return reverseResolveAlias(path, { ...nuxt?.options.alias || {}, ...strippedAtAliases }).pop() || path
}

const strippedAtAliases = {
  '@': '',
  '@@': '',
}
