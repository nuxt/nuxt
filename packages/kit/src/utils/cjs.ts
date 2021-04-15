import { join } from 'path'
import jiti from 'jiti'

// TODO: use create-require for jest environment
const _require = jiti(process.cwd())

export interface ResolveModuleOptions {
  paths?: string[]
}

export interface RequireModuleOptions extends ResolveModuleOptions {
  // TODO: use create-require for jest environment
  // native?: boolean
  /** Clear the require cache (force fresh require) but only if not within `node_modules` */
  clearCache?: boolean
  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

export function isNodeModules (id: string) {
  // TODO: Follow symlinks
  return /[/\\]node_modules[/\\]/.test(id)
}

export function clearRequireCache (id: string) {
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

export function scanRequireTree (id: string, files = new Set<string>()) {
  if (isNodeModules(id) || files.has(id)) {
    return files
  }

  const entry = getRequireCacheItem(id)

  if (!entry) {
    files.add(id)
    return files
  }

  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  return files
}

/** Access the require cache by module id. */
export function getRequireCacheItem (id: string) {
  try {
    return _require.cache[id]
  } catch (e) {
  }
}

/** Resolve the `package.json` file for a given module. */
export function requireModulePkg (id: string, opts: RequireModuleOptions = {}) {
  return requireModule(join(id, 'package.json'), opts)
}

/** Resolve the path of a module. */
export function resolveModule (id: string, opts: ResolveModuleOptions = {}) {
  return _require.resolve(id, {
    paths: opts.paths
  })
}

/** Try to resolve the path of a module, but don't emit an error if it can't be found. */
export function tryResolveModule (path: string, opts: ResolveModuleOptions = {}) {
  try {
    return resolveModule(path, opts)
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
  }
}

/** Require a module and return it. */
export function requireModule (id: string, opts: RequireModuleOptions = {}) {
  // Resolve id
  const resolvedPath = resolveModule(id, opts)

  // Clear require cache if necessary
  if (opts.clearCache && !isNodeModules(id)) {
    clearRequireCache(resolvedPath)
  }

  // Try to require
  let requiredModule = _require(resolvedPath)

  // Interop default
  if (opts.interopDefault !== false && requiredModule && requiredModule.default) {
    requiredModule = requiredModule.default
  }

  return requiredModule
}

/** Try to require a module, but don't emit an error if the module can't be required. */
export function tryRequireModule (id: string, opts: RequireModuleOptions = {}) {
  try {
    return requireModule(id, opts)
  } catch (e) {
  }
}
