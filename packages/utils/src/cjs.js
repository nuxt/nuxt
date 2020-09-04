import { join } from 'path'

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
    delete require.cache[id]
    return
  }

  if (entry.parent) {
    entry.parent.children = entry.parent.children.filter(e => e.id !== id)
  }

  // Needs to be cleared before children, to protect against circular deps (#7966)
  delete require.cache[id]

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
    return require.cache[id]
  } catch (e) {
  }
}

export function tryRequire (id) {
  try {
    return require(id)
  } catch (e) {
  }
}

export function getPKG (id) {
  return tryRequire(join(id, 'package.json'))
}
