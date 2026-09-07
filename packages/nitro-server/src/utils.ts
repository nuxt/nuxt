import { fileURLToPath } from 'node:url'
import { matchesGlob } from 'node:path'
import { dirname, join } from 'pathe'
import escapeRE from 'escape-string-regexp'

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
 * Convert Nuxt's gitignore-style ignore patterns into globs for the unstorage `fs` driver,
 * which matches them against the absolute path of a directory it walks into and against the
 * bare name of a file it lists, so a pattern has to be written to match both.
 *
 * 1. A gitignore pattern without a slash matches at any depth, so it is prefixed with `**\/`,
 *    which matches an absolute path and a bare name alike.
 * 2. A pattern containing a slash is anchored, so it is resolved against `base`. Such a
 *    pattern can only prune a directory, as a file is matched by name alone.
 * 3. A trailing slash (directory-only) has no meaning.
 * 4. Re-inclusion cannot be expressed in a flat list of globs at all, we drop whatever
 *    a negated pattern would 'undo'.
 *
 * Rules are order-sensitive (the last one to match a path wins), so a negated pattern
 * only drops the patterns declared before it.
 */
export function toFsDriverIgnorePatterns (patterns: string[], base: string): string[] {
  const globs: string[] = []
  for (const pattern of patterns) {
    const negated = pattern[0] === '!'
    const glob = toFsDriverGlob(negated ? pattern.slice(1) : pattern, base)
    if (!glob) {
      continue
    }
    if (!negated) {
      if (!globs.includes(glob)) {
        globs.push(glob)
      }
      continue
    }
    for (let i = globs.length - 1; i >= 0; i--) {
      const ignored = globs[i]!
      if (matchesGlob(glob, ignored) || matchesGlob(ignored, glob)) {
        globs.splice(i, 1)
      }
    }
  }
  return globs
}

function toFsDriverGlob (pattern: string, base: string): string | undefined {
  const trimmed = pattern.replace(/\/+$/, '')
  // a pattern that already matches at any depth is left alone
  if (trimmed.startsWith('**/')) {
    return trimmed
  }
  const glob = trimmed.replace(/^\//, '')
  // patterns resolved outside the mount base can never match a key within it
  if (!glob || glob.startsWith('../')) {
    return
  }
  return trimmed.includes('/') ? join(base, glob) : `**/${glob}`
}

let _distDir = dirname(fileURLToPath(import.meta.url))
if (/(?:chunks|shared)$/.test(_distDir)) { _distDir = dirname(_distDir) }

export const distDir = _distDir
