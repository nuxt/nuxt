import { promises as fsp, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, resolve, join, normalize, isAbsolute } from 'pathe'
import { globby } from 'globby'
import { resolveAlias as _resolveAlias } from 'pathe/utils'
import { tryUseNuxt } from './context'
import { tryResolveModule } from './internal/cjs'
import { isIgnored } from './ignore'

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
  const _path = path
  path = normalize(path)

  // Fast return if the path exists
  if (isAbsolute(path) && existsSync(path) && !(await isDirectory(path))) {
    return path
  }

  // Use current nuxt options
  const nuxt = tryUseNuxt()
  const cwd = opts.cwd || (nuxt ? nuxt.options.rootDir : process.cwd())
  const extensions = opts.extensions || (nuxt ? nuxt.options.extensions : ['.ts', '.mjs', '.cjs', '.json'])
  const modulesDir = nuxt ? nuxt.options.modulesDir : []

  // Resolve aliases
  path = resolveAlias(path)

  // Resolve relative to cwd
  if (!isAbsolute(path)) {
    path = resolve(cwd, path)
  }

  // Check if resolvedPath is a file
  let _isDir = false
  if (existsSync(path)) {
    _isDir = await isDirectory(path)
    if (!_isDir) {
      return path
    }
  }

  // Check possible extensions
  for (const ext of extensions) {
    // path.[ext]
    const pathWithExt = path + ext
    if (existsSync(pathWithExt)) {
      return pathWithExt
    }
    // path/index.[ext]
    const pathWithIndex = join(path, 'index' + ext)
    if (_isDir && existsSync(pathWithIndex)) {
      return pathWithIndex
    }
  }

  // Try to resolve as module id
  const resolveModulePath = tryResolveModule(_path, { paths: [cwd, ...modulesDir] })
  if (resolveModulePath) {
    return resolveModulePath
  }

  // Return normalized input
  return path
}

/**
 * Try to resolve first existing file in paths
 */
export async function findPath (paths: string|string[], opts?: ResolvePathOptions, pathType: 'file' | 'dir' = 'file'): Promise<string|null> {
  if (!Array.isArray(paths)) {
    paths = [paths]
  }
  for (const path of paths) {
    const rPath = await resolvePath(path, opts)
    if (await existsSensitive(rPath)) {
      const _isDir = await isDirectory(rPath)
      if (!pathType || (pathType === 'file' && !_isDir) || (pathType === 'dir' && _isDir)) {
        return rPath
      }
    }
  }
  return null
}

/**
 * Resolve path aliases respecting Nuxt alias options
 */
export function resolveAlias (path: string, alias?: Record<string, string>): string {
  if (!alias) {
    alias = tryUseNuxt()?.options.alias || {}
  }
  return _resolveAlias(path, alias)
}

export interface Resolver {
  resolve(...path: string[]): string
  resolvePath(path: string, opts?: ResolvePathOptions): Promise<string>
}

/**
 * Create a relative resolver
 */
export function createResolver (base: string | URL): Resolver {
  if (!base) {
    throw new Error('`base` argument is missing for createResolver(base)!')
  }

  base = base.toString()
  if (base.startsWith('file://')) {
    base = dirname(fileURLToPath(base))
  }

  return {
    resolve: (...path) => resolve(base as string, ...path),
    resolvePath: (path, opts) => resolvePath(path, { cwd: base as string, ...opts })
  }
}

// --- Internal ---

async function existsSensitive (path: string) {
  if (!existsSync(path)) { return false }
  const dirFiles = await fsp.readdir(dirname(path))
  return dirFiles.includes(basename(path))
}

// Usage note: We assume path existance is already ensured
async function isDirectory (path: string) {
  return (await fsp.lstat(path)).isDirectory()
}

export async function resolveFiles (path: string, pattern: string | string[], opts: { followSymbolicLinks?: boolean } = {}) {
  const files = await globby(pattern, { cwd: path, followSymbolicLinks: opts.followSymbolicLinks ?? true })
  return files.map(p => resolve(path, p)).filter(p => !isIgnored(p)).sort()
}
