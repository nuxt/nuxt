import { existsSync, lstatSync } from 'fs'
import { resolve, join } from 'upath'

export interface ResolveOptions {
  base?: string
  alias?: Record<string, string>
  extensions?: string[]
}

function resolvePath (path: string, opts: ResolveOptions = {}) {
  // Fast return in case of path exists
  if (existsSync(path)) {
    return path
  }

  let resolvedPath: string

  // Resolve alias
  if (opts.alias) {
    resolvedPath = resolveAlias(path, opts.alias)
  }

  // Resolve relative to base or cwd
  resolvedPath = resolve(opts.base || '.', resolvedPath)

  // Check if resolvedPath is a file
  let isDirectory = false
  if (existsSync(resolvedPath)) {
    isDirectory = lstatSync(resolvedPath).isDirectory()
    if (!isDirectory) {
      return resolvedPath
    }
  }

  // Check possible extensions
  for (const ext of opts.extensions) {
    // resolvedPath.[ext]
    const resolvedPathwithExt = resolvedPath + ext
    if (!isDirectory && existsSync(resolvedPathwithExt)) {
      return resolvedPathwithExt
    }
    // resolvedPath/index.[ext]
    const resolvedPathwithIndex = join(resolvedPath, 'index' + ext)
    if (isDirectory && existsSync(resolvedPathwithIndex)) {
      return resolvedPathwithIndex
    }
  }

  // If extension check fails and resolvedPath is a valid directory, return it
  if (isDirectory) {
    return resolvedPath
  }

  // Give up if it is neither a directory
  throw new Error(`Cannot resolve "${path}" from "${resolvedPath}"`)
}

export function resolveAlias (path: string, alias: ResolveOptions['alias']) {
  for (const key in alias) {
    if (path.startsWith(key)) {
      path = alias[key] + path.substr(key.length)
    }
  }
  return path
}

export function tryResolvePath (path: string, opts: ResolveOptions = {}) {
  try {
    return resolvePath(path, opts)
  } catch (e) {
  }
}
