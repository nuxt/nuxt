import { fileURLToPath } from 'node:url'
import { dirname } from 'pathe'
import escapeRE from 'escape-string-regexp'
import type { NuxtBuildOutputs } from '@nuxt/schema'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export const NUXT_BUILD_OUTPUT_MAP: Record<string, keyof NuxtBuildOutputs> = {
  'nuxt/entry': 'serverEntry',
  'nuxt/manifest': 'clientManifest',
  'nuxt/precomputed': 'clientPrecomputed',
  'nuxt/styles': 'ssrStyles',
  'nuxt/entry-chunk': 'entryChunkName',
  'nuxt/entry-ids': 'entryIds',
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
