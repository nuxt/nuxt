import { fileURLToPath } from 'node:url'
import { dirname } from 'pathe'
import escapeRE from 'escape-string-regexp'

export function toArray<T> (value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

const NODE_MODULES_SEGMENT = '/node_modules/'
const NODE_MODULES_PATTERN = 'node_modules\\/'

function normalizeNodeModulesPath (path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function getNodeModulePackageRoot (path: string): string | undefined {
  const normalized = normalizeNodeModulesPath(path)
  const nodeModulesIndex = normalized.lastIndexOf(NODE_MODULES_SEGMENT)
  if (nodeModulesIndex === -1) {
    return
  }

  // Nitro can safely auto-import from Nuxt-owned package roots, but not from
  // arbitrary files under node_modules. Treat the resolved package root as the
  // allow-list boundary and keep unrelated package subtrees excluded.
  const packagePath = normalized.slice(nodeModulesIndex + NODE_MODULES_SEGMENT.length)
  const [name, subname] = packagePath.split('/')
  if (!name || name === '.pnpm') {
    return
  }

  const packageName = name.startsWith('@')
    ? subname && `${name}/${subname}`
    : name

  if (!packageName) {
    return
  }

  return normalized.slice(0, nodeModulesIndex + NODE_MODULES_SEGMENT.length + packageName.length)
}

/**
 * Build the regex Nitro uses to skip transforming files under `node_modules`,
 * while still transforming files that belong to Nuxt layers or modules that
 * happen to live inside a `node_modules` directory.
 *
 * Allowed roots can contain multiple `/node_modules/` segments (nested npm
 * installs; pnpm's `.pnpm/<id>/node_modules/<name>` store). Match the complete
 * allowed root instead of only the package name suffix, otherwise a nested
 * package like `a/node_modules/b` could accidentally allow an unrelated
 * `node_modules/b` tree elsewhere.
 */
export function getNodeModulesExcludePattern (allowedRoots: Iterable<string>): RegExp {
  const allowedRootPatterns = new Set<string>()
  for (const allowedRoot of allowedRoots) {
    const root = normalizeNodeModulesPath(allowedRoot)
    if (root.includes(NODE_MODULES_SEGMENT)) {
      allowedRootPatterns.add(`${escapeRE(root)}(?:\\/(?!(?:${NODE_MODULES_PATTERN}|.*\\/${NODE_MODULES_PATTERN})).*)?`)
    }
  }

  if (!allowedRootPatterns.size) {
    return /node_modules/
  }

  const allowedRootAlternatives = [...allowedRootPatterns].map(pattern => `${pattern}$`).join('|')
  return new RegExp(`^(?!${allowedRootAlternatives}).*${NODE_MODULES_PATTERN}`)
}

export function getLayerNodeModulesExcludePattern (layerRoots: Iterable<string>): RegExp {
  return getNodeModulesExcludePattern(layerRoots)
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
