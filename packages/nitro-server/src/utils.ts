import { fileURLToPath } from 'node:url'
import type { Plugin } from 'rollup'
import { dirname } from 'pathe'
import escapeRE from 'escape-string-regexp'
import { resolveModulePath } from 'exsolve'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Packages that Nitro implicitly makes available to user server code but that
 * are not direct dependencies of the user's project: they are pulled in via
 * `@nuxt/nitro-server` -> `nitro`. Under pnpm's isolated layout they are absent
 * from the project's `node_modules`, so both their types and their runtime
 * resolution need to be routed to the copy Nitro itself depends on. This is the
 * single source of truth for `typescript.hoist` and the runtime resolve
 * fallback below.
 */
export const nitroImplicitDependencies = [
  'nitro',
  'h3',
  'srvx',
  'defu',
  'consola',
  'ofetch',
  'crossws',
] as const

const nitroRuntimeResolveRe = new RegExp(`^(?:${nitroImplicitDependencies.map(escapeRE).join('|')})(?:/|$)`)

/**
 * Fall back to Nitro's own copies of its implicit runtime dependencies when the
 * project cannot resolve them itself.
 *
 * Under pnpm's isolated layout these packages are not present in the project's
 * `node_modules`, so Nitro's `rootDir`-anchored `nodeResolve` cannot resolve
 * them from `server/` code. Resolving relative to the `nitro` package routes
 * them to the single instance Nitro already uses (`nitro` owns the rest as its
 * own dependencies), without a second copy being installed into the user's
 * project (which bypasses the builder/plugin context). When the project can
 * resolve them itself, this stays out of the way so Nitro's normal
 * externalization still applies.
 */
export function nitroRuntimeResolvePlugin (conditions?: string[]): Plugin {
  const cache = new Map<string, string | null>()
  const nitroDir = resolveModulePath('nitro/package.json', { from: import.meta.url, try: true })
  return {
    name: 'nuxt:nitro:runtime-resolve',
    async resolveId (id, importer) {
      if (!nitroDir || !nitroRuntimeResolveRe.test(id)) { return }
      if (await this.resolve(id, importer, { skipSelf: true })) { return }
      if (!cache.has(id)) {
        cache.set(id, resolveModulePath(id, { from: nitroDir, conditions, try: true }) ?? null)
      }
      const resolved = cache.get(id)
      if (resolved) {
        return resolved
      }
    },
  }
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
