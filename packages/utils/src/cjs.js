export function isExternalDependency (id) {
  return /[/\\]node_modules[/\\]/.test(id)
}

export function clearRequireCache (id) {
  let entry
  try {
    entry = require.cache[id]
  } catch (e) {
    delete require.cache[id]
    return
  }

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
  let entry
  try {
    entry = require.cache[id]
  } catch (e) {
    files.add(id)
    return files
  }

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
