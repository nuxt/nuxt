import { promises as fsp, existsSync } from 'fs'
import { basename, dirname, resolve, join, normalize, isAbsolute } from 'pathe'
import { globby } from 'globby'
import { useNuxt } from './context'
import { tryResolveModule } from '.'

export interface ResolvePathOptions {
  /** Base for resolving paths from. Default is Nuxt rootDir. */
  cwd?: string

  /** An object of aliases. Default is Nuxt configured aliases. */
  alias?: Record<string, string>

  /** The file extensions to try. Default is Nuxt configured extensions. */
  extensions?: string[]
}

/**
 * Resolve full path to a file or directory respecting Nuxt alias and extensions options
 *
 * If path could not be resolved, normalized input path will be returned
 */
export async function resolvePath (path: string, opts: ResolvePathOptions = {}): Promise<string> {
  // Always normalize input
  path = normalize(path)

  // Fast return if the path exists
  if (existsSync(path)) {
    return path
  }

  // Use current nuxt options
  const nuxt = useNuxt()
  const cwd = opts.cwd || nuxt.options.rootDir
  const extensions = opts.extensions || nuxt.options.extensions
  const modulesDir = nuxt.options.modulesDir

  // Resolve aliases
  path = resolveAlias(path)

  // Resolve relative to cwd
  if (!isAbsolute(path)) {
    path = resolve(cwd, path)
  }

  // Check if resolvedPath is a file
  let isDirectory = false
  if (existsSync(path)) {
    isDirectory = (await fsp.lstat(path)).isDirectory()
    if (!isDirectory) {
      return path
    }
  }

  // Check possible extensions
  for (const ext of extensions) {
    // path.[ext]
    const pathWithExt = path + ext
    if (!isDirectory && existsSync(pathWithExt)) {
      return pathWithExt
    }
    // path/index.[ext]
    const pathWithIndex = join(path, 'index' + ext)
    if (isDirectory && existsSync(pathWithIndex)) {
      return pathWithIndex
    }
  }

  // Try to resolve as module id
  const resolveModulePath = tryResolveModule(path, { paths: modulesDir })
  if (resolveModulePath) {
    return resolveModulePath
  }

  // Return normalized input
  return path
}

/**
 * Try to resolve first existing file in paths
 */
export async function findPath (paths: string[], opts?: ResolvePathOptions): Promise<string|null> {
  for (const path of paths) {
    const rPath = await resolvePath(path, opts)
    if (await existsSensitive(rPath)) {
      return rPath
    }
  }
  return null
}

/**
 * Resolve path aliases respecting Nuxt alias options
 */
export function resolveAlias (path: string, alias?: Record<string, string>): string {
  if (!alias) {
    alias = useNuxt().options.alias
  }
  for (const key in alias) {
    if (key === '@' && !path.startsWith('@/')) { continue } // Don't resolve @foo/bar
    if (path.startsWith(key)) {
      path = alias[key] + path.slice(key.length)
    }
  }
  return path
}

// --- Internal ---

async function existsSensitive (path: string) {
  if (!existsSync(path)) { return false }
  const dirFiles = await fsp.readdir(dirname(path))
  return dirFiles.includes(basename(path))
}

export async function resolveFiles (path: string, pattern: string | string[]) {
  const files = await globby(pattern, { cwd: path, followSymbolicLinks: true })
  return files.map(p => resolve(path, p))
}
