import { pathToFileURL } from 'node:url'
import { normalize } from 'pathe'
import { interopDefault } from 'mlly'
import jiti from 'jiti'

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
  /** Clear the require cache (force fresh require) but only if not within `node_modules` */
  clearCache?: boolean

  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

/** @deprecated Do not use CJS utils */
function isNodeModules (id: string) {
  // TODO: Follow symlinks
  return /[/\\]node_modules[/\\]/.test(id)
}

/** @deprecated Do not use CJS utils */
function clearRequireCache (id: string) {
  if (isNodeModules(id)) {
    return
  }

  const entry = getRequireCacheItem(id)

  if (!entry) {
    delete _require.cache[id]
    return
  }

  if (entry.parent) {
    entry.parent.children = entry.parent.children.filter(e => e.id !== id)
  }

  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  delete _require.cache[id]
}

/** @deprecated Do not use CJS utils */
function getRequireCacheItem (id: string) {
  try {
    return _require.cache[id]
  } catch (e) {
    // ignore issues accessing require.cache
  }
}

export function getModulePaths (paths?: string[] | string) {
  return ([] as Array<string | undefined>).concat(
    global.__NUXT_PREPATHS__,
    paths || [],
    process.cwd(),
    global.__NUXT_PATHS__
  ).filter(Boolean) as string[]
}

/** @deprecated Do not use CJS utils */
export function resolveModule (id: string, opts: ResolveModuleOptions = {}) {
  return normalize(_require.resolve(id, {
    paths: getModulePaths(opts.paths)
  }))
}

/** @deprecated Do not use CJS utils */
export function requireModule (id: string, opts: RequireModuleOptions = {}) {
  // Resolve id
  const resolvedPath = resolveModule(id, opts)

  // Clear require cache if necessary
  if (opts.clearCache && !isNodeModules(id)) {
    clearRequireCache(resolvedPath)
  }

  // Try to require
  const requiredModule = _require(resolvedPath)

  return requiredModule
}

/** @deprecated Do not use CJS utils */
export function importModule (id: string, opts: RequireModuleOptions = {}) {
  const resolvedPath = resolveModule(id, opts)
  if (opts.interopDefault !== false) {
    return import(pathToFileURL(resolvedPath).href).then(interopDefault)
  }
  return import(pathToFileURL(resolvedPath).href)
}

/** @deprecated Do not use CJS utils */
export function tryImportModule (id: string, opts: RequireModuleOptions = {}) {
  try {
    return importModule(id, opts).catch(() => undefined)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}

/** @deprecated Do not use CJS utils */
export function tryRequireModule (id: string, opts: RequireModuleOptions = {}) {
  try {
    return requireModule(id, opts)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}
