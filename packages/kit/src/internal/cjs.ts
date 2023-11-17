import { pathToFileURL } from 'node:url'
import { normalize } from 'pathe'
import { interopDefault } from 'mlly'
import jiti from 'jiti'
import { toArray } from '../utils'

// TODO: use create-require for jest environment
const _require = jiti(process.cwd(), { interopDefault: true, esmResolve: true })

/** @deprecated Do not use CJS utils */
export interface ResolveModuleOptions {
  paths?: string | string[]
}

/** @deprecated Do not use CJS utils */
export interface RequireModuleOptions extends ResolveModuleOptions {
  // TODO: use create-require for jest environment
  // native?: boolean
  /**
   * Clear the require cache (force fresh require)
   * but only if not within `node_modules`
   */
  clearCache?: boolean

  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
function isNodeModules(id: string) {
  // TODO: Follow symlinks
  return /[/\\]node_modules[/\\]/.test(id)
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
function clearRequireCache(id: string) {
  if (isNodeModules(id)) {
    return
  }

  const entry = getRequireCacheItem(id)

  if (!entry) {
    // eslint-disable-next-line ts/no-dynamic-delete
    delete _require.cache[id]

    return
  }

  if (entry.parent) {
    entry.parent.children = entry.parent.children.filter(
      (module) => module.id !== id
    )
  }

  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  // eslint-disable-next-line ts/no-dynamic-delete
  delete _require.cache[id]
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
function getRequireCacheItem(id: string) {
  try {
    return _require.cache[id]
  } catch {}
}

export function getModulePaths(paths?: string[] | string) {
  return [
    ...toArray((global.__NUXT_PREPATHS__ || [])),
    ...toArray((paths || [])),
    process.cwd(),
    ...toArray((global.__NUXT_PATHS__ || []))
  ]
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
export function resolveModule(id: string, options: ResolveModuleOptions = {}) {
  return normalize(_require.resolve(id, {
    paths: getModulePaths(options.paths)
  }))
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
export function requireModule(id: string, options: RequireModuleOptions = {}) {
  // Resolve id
  const resolvedPath = resolveModule(id, options)

  // Clear require cache if necessary
  if (options.clearCache && !isNodeModules(id)) {
    clearRequireCache(resolvedPath)
  }

  // Try to require
  // eslint-disable-next-line ts/no-unsafe-assignment
  const requiredModule = _require(resolvedPath)

  // eslint-disable-next-line ts/no-unsafe-return
  return requiredModule
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
export function importModule(id: string, options: RequireModuleOptions = {}) {
  const resolvedPath = resolveModule(id, options)

  if (options.interopDefault !== false) {
    return import(pathToFileURL(resolvedPath).href).then(interopDefault)
  }

  return import(pathToFileURL(resolvedPath).href)
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
export function tryImportModule(
  id: string,
  options: RequireModuleOptions = {}
) {
  try {
    return importModule(id, options).catch(() => {})
  } catch {}
}

// eslint-disable-next-line jsdoc/require-param, jsdoc/require-returns
/** @deprecated Do not use CJS utils */
export function tryRequireModule(
  id: string,
  options: RequireModuleOptions = {}
) {
  try {
    // eslint-disable-next-line ts/no-unsafe-return
    return requireModule(id, options)
  } catch {}
}
