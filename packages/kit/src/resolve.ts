import { existsSync, promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'pathe'
import { globby } from 'globby'
import { resolvePath as _resolvePath } from 'mlly'
import { resolveAlias as _resolveAlias } from 'pathe/utils'
import { tryUseNuxt } from './context'
import { isIgnored } from './ignore'
import { toArray } from './utils'

export interface ResolvePathOptions {
  /** Base for resolving paths from. Default is Nuxt rootDir. */
  cwd?: string

  /** An object of aliases. Default is Nuxt configured aliases. */
  alias?: Record<string, string>

  /** The file extensions to try. Default is Nuxt configured extensions. */
  extensions?: string[]
}

/**
 * Resolve full path to a file or directory
 * respecting Nuxt alias and extensions options
 *
 * If path could not be resolved, normalized input path will be returned
 */
export async function resolvePath(
  path: string,
  options: ResolvePathOptions = {}
): Promise<string> {
  // Always normalize input
  const _path = path

  path = normalize(path)

  // Fast return if the path exists
  if (isAbsolute(path) && existsSync(path) && !(await isDirectory(path))) {
    return path
  }

  // Use current nuxt options
  const nuxt = tryUseNuxt()
  const cwd = options.cwd || (nuxt ? nuxt.options.rootDir : process.cwd())
  const extensions = options.extensions || (nuxt ? nuxt.options.extensions : ['.ts', '.mjs', '.cjs', '.json'])
  const modulesDirectory = nuxt ? nuxt.options.modulesDir : []

  // Resolve aliases
  path = resolveAlias(path)

  // Resolve relative to cwd
  if (!isAbsolute(path)) {
    path = resolve(cwd, path)
  }

  // Check if resolvedPath is a file
  let _isDirectory = false

  if (existsSync(path)) {
    _isDirectory = await isDirectory(path)

    if (!_isDirectory) {
      return path
    }
  }

  // Check possible extensions
  for (const extension of extensions) {
    // path.[ext]
    const pathWithExtension = path + extension

    if (existsSync(pathWithExtension)) {
      return pathWithExtension
    }

    // path/index.[ext]
    const pathWithIndex = join(path, 'index' + extension)

    if (_isDirectory && existsSync(pathWithIndex)) {
      return pathWithIndex
    }
  }

  // Try to resolve as module id
  const resolveModulePath = await _resolvePath(
    _path, { url: [cwd, ...modulesDirectory] }
  ).catch(() => {})

  if (resolveModulePath) {
    return resolveModulePath
  }

  // Return normalized input
  return path
}

/**
 * Try to resolve first existing file in paths
 */
export async function findPath(
  paths: string | string[],
  options?: ResolvePathOptions,
  pathType: 'file' | 'dir' = 'file'
): Promise<string | null> {
  for (const path of toArray(paths)) {
    const rPath = await resolvePath(path, options)

    if (await existsSensitive(rPath)) {
      const _isDirectory = await isDirectory(rPath)

      if ((pathType === 'file' && !_isDirectory) || (pathType === 'dir' && _isDirectory)) {
        return rPath
      }
    }
  }

  // eslint-disable-next-line unicorn/no-null
  return null
}

/**
 * Resolve path aliases respecting Nuxt alias options
 */
export function resolveAlias(
  path: string,
  alias?: Record<string, string>
): string {
  if (!alias) {
    alias = tryUseNuxt()?.options.alias || {}
  }

  return _resolveAlias(path, alias)
}

export interface Resolver {
  resolve (...path: string[]): string
  resolvePath (path: string, options?: ResolvePathOptions): Promise<string>
}

/**
 * Create a relative resolver
 */
export function createResolver(base: string | URL): Resolver {
  if (!base) {
    throw new Error('`base` argument is missing for createResolver(base)!')
  }

  base = base.toString()

  if (base.startsWith('file://')) {
    base = dirname(fileURLToPath(base))
  }

  return {
    resolve: (...path) => resolve(base as string, ...path),
    resolvePath: (path, options) => resolvePath(
      path, { cwd: base as string, ...options }
    )
  }
}

export async function resolveNuxtModule(base: string, paths: string[]) {
  const resolved = []
  const resolver = createResolver(base)

  for (const path of paths) {
    if (path.startsWith(base)) {
      resolved.push(path.split('/index.ts')[0])
    } else {
      const resolvedPath = await resolver.resolvePath(path)

      resolved.push(
        resolvedPath.slice(0, resolvedPath.lastIndexOf(path) + path.length)
      )
    }
  }

  return resolved
}

// --- Internal ---

async function existsSensitive(path: string) {
  if (!existsSync(path)) {
    return false
  }

  const directoryFiles = await fsp.readdir(dirname(path))

  return directoryFiles.includes(basename(path))
}

// Usage note: We assume path existence is already ensured
async function isDirectory(path: string) {
  const pathStats = await fsp.lstat(path)

  return pathStats.isDirectory()
}

export async function resolveFiles(
  path: string,
  pattern: string | string[],
  options: { followSymbolicLinks?: boolean } = {}
) {
  const files = await globby(
    pattern,
    { cwd: path, followSymbolicLinks: options.followSymbolicLinks ?? true }
  )

  return files.map(
    (p) => resolve(path, p)
  ).filter(
    (p) => !isIgnored(p)
  ).sort()
}
