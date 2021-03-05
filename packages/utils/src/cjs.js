import { join } from 'path'
import _createRequire from 'create-require'
import jiti from 'jiti'

export const createRequire = (filename, useJiti = global.__NUXT_DEV__) => {
  if (useJiti && typeof jest === 'undefined') {
    return jiti(filename)
  }

  return _createRequire(filename)
}

const _require = createRequire()

export function isHMRCompatible (id) {
  return !/[/\\]mongoose[/\\/]/.test(id)
}

export function isExternalDependency (id) {
  return /[/\\]node_modules[/\\]/.test(id)
}

export function clearRequireCache (id) {
  if (isExternalDependency(id) && isHMRCompatible(id)) {
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

  // Needs to be cleared before children, to protect against circular deps (#7966)
  delete _require.cache[id]

  for (const child of entry.children) {
    clearRequireCache(child.id)
  }
}

export function scanRequireTree (id, files = new Set()) {
  if (isExternalDependency(id) || files.has(id)) {
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

export function getRequireCacheItem (id) {
  try {
    return _require.cache[id]
  } catch (e) {
  }
}

export function resolveModule (id, paths) {
  if (typeof paths === 'string') {
    paths = [paths]
  }
  return _require.resolve(id, {
    paths: [].concat(...(global.__NUXT_PREPATHS__ || []), paths || [], global.__NUXT_PATHS__ || [], process.cwd())
  })
}

export function requireModule (id, paths) {
  return _require(resolveModule(id, paths))
}

export function tryRequire (id, paths) {
  try { return requireModule(id, paths) } catch (e) { }
}

export function tryResolve (id, paths) {
  try { return resolveModule(id, paths) } catch (e) { }
}

export function getPKG (id, paths) {
  return tryRequire(join(id, 'package.json'), paths)
}
