import { sep } from 'path'

export function isExternalDependency (id) {
  return id.includes(`${sep}node_modules${sep}`)
}

export function clearRequireCache (id) {
  const entry = require.cache[id]
  if (!entry || isExternalDependency(id)) {
    return
  }

  if (entry.parent) {
    entry.parent.children = entry.parent.children.filter(e => e.id !== id)
  }

  for (const child of entry.children) {
    clearRequireCache(child.id)
  }

  delete require.cache[id]
}

export function scanRequireTree (id, files = new Set()) {
  const entry = require.cache[id]
  if (!entry || isExternalDependency(id) || files.has(id)) {
    return files
  }

  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  return files
}

export function tryRequire (id) {
  try {
    return require(id)
  } catch (e) {
  }
}

export function getPKG (id) {
  return tryRequire(id + '/package.json')
}
