import { promises as fsp } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, dirname, isAbsolute, join, normalize, resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { resolveModulePath } from 'exsolve'
import { resolveAlias as _resolveAlias } from 'pathe/utils'
import { directoryToURL } from './internal/esm'
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

  /**
   * Whether to resolve files that exist in the Nuxt VFS (for example, as a Nuxt template).
   * @default false
   */
  virtual?: boolean

  /**
   * Whether to fallback to the original path if the resolved path does not exist instead of returning the normalized input path.
   *
   * @default false
   */
  fallbackToOriginal?: boolean
}

/**
 * Resolve full path to a file or directory respecting Nuxt alias and extensions options
 *
 * If path could not be resolved, normalized input path will be returned
 */
export async function resolvePath (path: string, opts: ResolvePathOptions = {}): Promise<string> {
  const res = await _resolvePathGranularly(path, opts)

  if (res.type === 'file') {
    return res.path
  }

  // Return normalized input
  return opts.fallbackToOriginal ? path : res.path
}

/**
 * Try to resolve first existing file in paths
 */
export async function findPath (paths: string | string[], opts?: ResolvePathOptions, pathType: 'file' | 'dir' = 'file'): Promise<string | null> {
  for (const path of toArray(paths)) {
    const res = await _resolvePathGranularly(path, opts)

    if (!res.type || (pathType && res.type !== pathType)) {
      continue
    }

    // Check file system
    if (res.virtual || await existsSensitive(res.path)) {
      return res.path
    }
  }
  return null
}

/**
 * Resolve path aliases respecting Nuxt alias options
 */
export function resolveAlias (path: string, alias?: Record<string, string>): string {
  alias ||= tryUseNuxt()?.options.alias || {}
  return _resolveAlias(path, alias)
}

export interface Resolver {
  resolve (...path: string[]): string
  resolvePath (path: string, opts?: ResolvePathOptions): Promise<string>
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
    resolvePath: (path, opts) => resolvePath(path, { cwd: base as string, ...opts }),
  }
}

export async function resolveNuxtModule (base: string, paths: string[]): Promise<string[]> {
  const resolved: string[] = []
  const resolver = createResolver(base)

  for (const path of paths) {
    if (path.startsWith(base)) {
      resolved.push(path.split('/index.ts')[0]!)
    } else {
      const resolvedPath = await resolver.resolvePath(path)
      resolved.push(resolvedPath.slice(0, resolvedPath.lastIndexOf(path) + path.length))
    }
  }

  return resolved
}

// --- Internal ---

interface PathResolution {
  path: string
  type?: 'file' | 'dir'
  virtual?: boolean
}

async function _resolvePathType (path: string, opts: ResolvePathOptions = {}, skipFs = false): Promise<PathResolution | undefined> {
  if (opts?.virtual && existsInVFS(path)) {
    return {
      path,
      type: 'file',
      virtual: true,
    }
  }

  if (skipFs) {
    return
  }

  const fd = await fsp.open(path, 'r').catch(() => null)
  try {
    const stats = await fd?.stat()
    if (stats) {
      return {
        path,
        type: stats.isFile() ? 'file' : 'dir',
        virtual: false,
      }
    }
  } finally {
    fd?.close()
  }
}

async function _resolvePathGranularly (path: string, opts: ResolvePathOptions = {}): Promise<PathResolution> {
  // Always normalize input
  const _path = path
  path = normalize(path)

  // Fast return if the path exists
  if (isAbsolute(path)) {
    const res = await _resolvePathType(path, opts)
    if (res && res.type === 'file') {
      return res
    }
  }

  // Use current nuxt options
  const nuxt = tryUseNuxt()
  const cwd = opts.cwd || (nuxt ? nuxt.options.rootDir : process.cwd())
  const extensions = opts.extensions || (nuxt ? nuxt.options.extensions : ['.ts', '.mjs', '.cjs', '.json'])
  const modulesDir = nuxt ? nuxt.options.modulesDir : []

  // Resolve aliases
  path = _resolveAlias(path, opts.alias ?? nuxt?.options.alias ?? {})

  // Resolve relative to cwd
  if (!isAbsolute(path)) {
    path = resolve(cwd, path)
  }

  const res = await _resolvePathType(path, opts)
  if (res && res.type === 'file') {
    return res
  }

  // Check possible extensions
  for (const ext of extensions) {
    // path.[ext]
    const extPath = await _resolvePathType(path + ext, opts)
    if (extPath && extPath.type === 'file') {
      return extPath
    }

    // path/index.[ext]
    const indexPath = await _resolvePathType(join(path, 'index' + ext), opts, res?.type !== 'dir' /* skip checking if parent is not a directory */)
    if (indexPath && indexPath.type === 'file') {
      return indexPath
    }
  }

  // Try to resolve as module id
  const resolvedModulePath = resolveModulePath(_path, {
    try: true,
    suffixes: ['', 'index'],
    from: [cwd, ...modulesDir].map(d => directoryToURL(d)),
  })
  if (resolvedModulePath) {
    return {
      path: resolvedModulePath,
      type: 'file',
      virtual: false,
    }
  }

  // Return normalized input
  return {
    path,
  }
}

async function existsSensitive (path: string) {
  const dirFiles = new Set(await fsp.readdir(dirname(path)).catch(() => []))
  return dirFiles.has(basename(path))
}

function existsInVFS (path: string, nuxt = tryUseNuxt()) {
  if (!nuxt) { return false }

  if (path in nuxt.vfs) {
    return true
  }

  const templates = nuxt.apps.default?.templates ?? nuxt.options.build.templates
  return templates.some(template => template.dst === path)
}

export async function resolveFiles (path: string, pattern: string | string[], opts: { followSymbolicLinks?: boolean } = {}) {
  const files: string[] = []
  for (const file of await glob(pattern, { cwd: path, followSymbolicLinks: opts.followSymbolicLinks ?? true })) {
    const p = resolve(path, file)
    if (!isIgnored(p)) {
      files.push(p)
    }
  }
  return files.sort()
}
