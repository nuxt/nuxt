import { fileURLToPath } from 'node:url'
import { matchesGlob } from 'node:path'
import { dirname } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { Nuxt } from '@nuxt/schema'

/**
 * Compile-time constants the server bundle needs which Nitro does not inject itself.
 */
export function getServerReplacements (nuxt: Nuxt): Record<string, string> {
  return {
    '__VUE_PROD_DEVTOOLS__': String(false),
    'import.meta.test': String(!!nuxt.options.test),
  }
}

/**
 * Specifier the app and the server runtime both import the asset URL helpers through,
 * provided by the `paths.mjs` template Nuxt generates.
 */
export const PATHS_SPECIFIER = '#internal/nuxt/paths'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

const NODE_MODULES_RE = /\/node_modules\//g

/**
 * Build the regex Nitro uses to skip transforming files under `node_modules`,
 * while still transforming files that belong to layers that happen to live
 * inside a `node_modules` directory.
 *
 * Layer paths can contain multiple `/node_modules/` segments (nested npm
 * installs; pnpm's `.pnpm/<id>/node_modules/<name>` store). The exclude
 * pattern is `node_modules/(?!<alts>)` evaluated at every `node_modules/`
 * boundary, so we push the suffix at each boundary to make the lookahead
 * fail wherever the layer's own files live.
 */
export function getLayerNodeModulesExcludePattern (layerRoots: Iterable<string>): RegExp {
  const excludePaths: string[] = []
  for (const layerRoot of layerRoots) {
    const root = layerRoot.replace(/\/$/, '')
    NODE_MODULES_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = NODE_MODULES_RE.exec(root))) {
      const suffix = root.slice(match.index + match[0].length)
      if (suffix) {
        excludePaths.push(escapeRE(suffix))
      }
      NODE_MODULES_RE.lastIndex = match.index + 1
    }
  }
  return excludePaths.length
    ? new RegExp(`node_modules\\/(?!${excludePaths.join('|')})`)
    : /node_modules/
}

/**
 * Convert Nuxt's gitignore-style ignore patterns into globs for the unstorage `fs`
 * driver, which matches them with `node:path` `matchesGlob` relative to the mount base.
 *
 * 1. A gitignore pattern without a slash matches at any depth, so it is prefixed with `**\/`
 * 2. A trailing slash (directory-only) and a leading slash (anchored) have no meaning.
 * 3. Re-inclusion cannot be expressed in a flat list of globs at all, we drop whatever
 *    a negated pattern would 'undo'.
 */
export function toFsDriverIgnorePatterns (patterns: string[]): string[] {
  const globs = new Set<string>()
  const rescued = new Set<string>()
  for (const pattern of patterns) {
    const negated = pattern[0] === '!'
    const glob = toFsDriverGlob(negated ? pattern.slice(1) : pattern)
    if (glob) {
      (negated ? rescued : globs).add(glob)
    }
  }
  if (!rescued.size) {
    return [...globs]
  }
  return [...globs].filter(glob => ![...rescued].some(path => matchesGlob(path, glob)))
}

function toFsDriverGlob (pattern: string): string | undefined {
  const trimmed = pattern.replace(/\/+$/, '')
  const anchored = trimmed.includes('/')
  const glob = trimmed.replace(/^\//, '')
  // patterns resolved outside the mount base can never match a key within it
  if (!glob || glob.startsWith('../')) {
    return
  }
  return anchored ? glob : `**/${glob}`
}

/**
 * Build the `resolve.conditions` array applied to the SSR vite environment.
 *
 * `'import'` is required so that packages whose top-level `exports` map is
 * keyed only by `import`/`require` (notably `vue` and `vue-router`) resolve
 * when the only available copy is nested under `nuxt`'s own `node_modules`.
 */
export function getSsrResolveConditions (exportConditions?: string[]): string[] {
  const conditions = [...exportConditions || []]
  if (!conditions.includes('import')) {
    conditions.push('import')
  }
  return conditions
}

let _distDir = dirname(fileURLToPath(import.meta.url))
if (/(?:chunks|shared)$/.test(_distDir)) { _distDir = dirname(_distDir) }

export const distDir = _distDir
