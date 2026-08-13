import { promises as fsp, statSync } from 'node:fs'
import { tryUseNuxt, useLogger } from '@nuxt/kit'
import { link } from 'clickable-path'
import { reverseResolveAlias } from 'pathe/utils'

import type { Nuxt } from '@nuxt/schema'

/** @since 3.9.0 */
export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export async function isDirectory (path: string) {
  try {
    return (await fsp.lstat(path)).isDirectory()
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    // A missing path (ENOENT) or a non-directory ancestor (ENOTDIR) is simply not a directory
    if (code === 'ENOENT' || code === 'ENOTDIR') { return false }
    throw err
  }
}

export function isDirectorySync (path: string) {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
  } catch (err) {
    // ENOTDIR should be treated as "not a directory" instead of an error
    if ((err as NodeJS.ErrnoException).code === 'ENOTDIR') { return false }
    throw err
  }
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

export const JS_EXT_RE = /^[^?]*\.(?:[jt]sx?|[cm][jt]s)(?:$|\?)/
export const NUXT_LIB_RE = /^[^?]*node_modules\/(?:nuxt|nuxt3|nuxt-nightly|@nuxt)\//
export const STYLE_QUERY_RE = /[?&]type=style/
export const MACRO_QUERY_RE = /[?&]macro(?:=|&|$)/
export const DECLARATION_EXTENSIONS = ['d.ts', 'd.mts', 'd.cts', 'd.vue.ts', 'd.vue.mts', 'd.vue.cts']

export const logger = useLogger('nuxt')

export function resolveToAlias (path: string, nuxt = tryUseNuxt()) {
  return reverseResolveAlias(path, { ...nuxt?.options.alias || {}, ...strippedAtAliases }).pop() || path
}

const strippedAtAliases = {
  '@': '',
  '@@': '',
}

const QUERY_RE = /\?.*$/

interface Position { line?: number, column?: number }

/** Convert a 0-based offset within `code` into a 1-based line and column. */
export function offsetToPosition (code: string, offset: number): Position {
  let line = 1
  let lineStart = 0
  const end = Math.min(offset, code.length)
  for (let i = 0; i < end; i++) {
    if (code.charCodeAt(i) === 10 /* \n */) {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: end - lineStart + 1 }
}

/**
 * Format `path` as its aliased form (`~/pages/index.vue`), wrapped in an OSC 8
 * hyperlink so that supporting terminals can open the file at `line`/`column`.
 *
 * Aliased paths cannot be opened by clicking, and the hyperlink target is an
 * absolute `file://` URL that isn't rendered, so the printed text is unchanged.
 *
 * Any module query (`?vue&type=template`) is dropped, as it is not part of the
 * path on disk.
 */
export function linkToAlias (path: string, nuxt: Nuxt | null = tryUseNuxt(), position?: Position) {
  return link(path.replace(QUERY_RE, ''), {
    ...position,
    cwd: nuxt?.options.rootDir,
    // without a Nuxt instance there are no aliases to resolve against, so the
    // default `cwd`-relative label applies
    formatter: nuxt ? (absolute, line, column) => resolveToAlias(absolute, nuxt) + (line === undefined ? '' : `:${line}${column === undefined ? '' : `:${column}`}`) : undefined,
  })
}
