import { pathToFileURL } from 'node:url'
import { join, normalize } from 'pathe'
import { interopDefault } from 'mlly'
import jiti from 'jiti'

// TODO: use create-require for jest environment
const _require = jiti(process.cwd(), { interopDefault: true })

export interface ResolveModuleOptions {
  paths?: string | string[]
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
  return normalize(_require.resolve(id, {
    paths: [].concat(
      // @ts-ignore
      global.__NUXT_PREPATHS__,
      opts.paths,
      process.cwd(),
      // @ts-ignore
      global.__NUXT_PATHS__
    ).filter(Boolean)
  }))
}

/** Try to resolve the path of a module, but don't emit an error if it can't be found. */
export function tryResolveModule (path: string, opts: ResolveModuleOptions = {}): string | null {
  try {
    return resolveModule(path, opts)
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') {
      throw error
    }
  }
  return null
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
  const requiredModule = _require(resolvedPath)

  return requiredModule
}

export function importModule (id: string, opts: RequireModuleOptions = {}) {
  const resolvedPath = resolveModule(id, opts)
  if (opts.interopDefault !== false) {
    return import(pathToFileURL(resolvedPath).href).then(interopDefault)
  }
  return import(pathToFileURL(resolvedPath).href)
}

export function tryImportModule (id: string, opts: RequireModuleOptions = {}) {
  try {
    return importModule(id, opts).catch(() => undefined)
  } catch { }
}

/** Try to require a module, but don't emit an error if the module can't be required. */
export function tryRequireModule (id: string, opts: RequireModuleOptions = {}) {
  try {
    return requireModule(id, opts)
  } catch (e) {
  }
}
