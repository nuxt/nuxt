export function clearRequireCache (id) {
  const entry = require.cache[id]
  if (!entry || id.includes('node_modules')) {
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
  if (!entry || id.includes('node_modules') || files.has(id)) {
    return files
  }

  files.add(entry.id)

  for (const child of entry.children) {
    scanRequireTree(child.id, files)
  }

  return files
}
