import { existsSync, lstatSync, readdirSync } from 'fs'
import { basename, dirname, resolve, join } from 'pathe'
import { globby } from 'globby'

export interface ResolveOptions {
  /**
   * The base path against which to resolve the path
   *
   * @default .
   */
  base?: string
  /**
   * An object of aliases (alias, path) to take into account, for example
   * `{ 'example/alias': '/full/path/to/alias' }`
   */
  alias?: Record<string, string>
  /** The file extensions to try (for example, ['js', 'ts']) */
  extensions?: string[]
}

function resolvePath (path: string, opts: ResolveOptions = {}) {
  // Fast return if the path exists
  if (existsSyncSensitive(path)) {
    return path
  }

  let resolvedPath: string

  // Resolve alias
  if (opts.alias) {
    resolvedPath = resolveAlias(path, opts.alias)
  }

  // Resolve relative to base or cwd
  resolvedPath = resolve(opts.base || '.', resolvedPath)

  const resolvedPathFiles = readdirSync(dirname(resolvedPath))

  // Check if resolvedPath is a file
  let isDirectory = false
  if (existsSyncSensitive(resolvedPath, resolvedPathFiles)) {
    isDirectory = lstatSync(resolvedPath).isDirectory()
    if (!isDirectory) {
      return resolvedPath
    }
  }

  // Check possible extensions
  for (const ext of opts.extensions) {
    // resolvedPath.[ext]
    const resolvedPathwithExt = resolvedPath + ext
    if (!isDirectory && existsSyncSensitive(resolvedPathwithExt, resolvedPathFiles)) {
      return resolvedPathwithExt
    }
    // resolvedPath/index.[ext]
    const resolvedPathwithIndex = join(resolvedPath, 'index' + ext)
    if (isDirectory && existsSyncSensitive(resolvedPathwithIndex)) {
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

function existsSyncSensitive (path: string, files?: string[]) {
  if (!existsSync(path)) { return false }
  const _files = files || readdirSync(dirname(path))
  return _files.includes(basename(path))
}

/**
 * Return a path with any relevant aliases resolved.
 *
 * @example
 * ```js
 * const aliases = { 'test': '/here/there' }
 * resolveAlias('test/everywhere', aliases)
 * // '/here/there/everywhere'
 */
export function resolveAlias (path: string, alias: ResolveOptions['alias']) {
  for (const key in alias) {
    if (key === '@' && !path.startsWith('@/')) { continue } // Don't resolve @foo/bar
    if (path.startsWith(key)) {
      path = alias[key] + path.slice(key.length)
    }
  }
  return path
}

/**
 * Resolve the path of a file but don't emit an error,
 * even if the module can't be resolved.
 */
export function tryResolvePath (path: string, opts: ResolveOptions = {}) {
  try {
    return resolvePath(path, opts)
  } catch (e) {
  }
}

export async function resolveFiles (path: string, pattern: string) {
  const files = await globby(pattern, {
    cwd: path,
    followSymbolicLinks: true
  })
  return files.map(p => resolve(path, p))
}
