/**
 * Whether `path` is `dir` itself or inside it, with or without a trailing slash on `dir`.
 * Both paths must already be normalised to forward slashes.
 */
export function isWithinDir (path: string, dir: string): boolean {
  if (dir.endsWith('/')) {
    return path.startsWith(dir) || (path.length === dir.length - 1 && dir.startsWith(path))
  }
  return path.startsWith(dir) && (path.length === dir.length || path[dir.length] === '/')
}

const NODE_MODULES_RE = /(?:^|[\\/])node_modules(?:[\\/]|$)/

/**
 * Whether `path` belongs to an installed package, rather than to the project itself.
 */
export function isInsideNodeModules (path: string): boolean {
  return NODE_MODULES_RE.test(path)
}
