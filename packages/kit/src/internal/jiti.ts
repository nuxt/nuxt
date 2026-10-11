import { readFileSync, realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'pathe'
import { resolveModulePath } from 'exsolve'
import { directoryToURL } from './esm.ts'
import { ensureDependencyInstalled } from '../dependency.ts'

export type Jiti = ReturnType<typeof import('jiti')['createJiti']>
type JitiModule = typeof import('jiti')

// Errors the runtime raises when it declines to load a file, as opposed to errors the file itself
// raises once it is running. Only the former are worth retrying through jiti.
const LOADER_ERROR_CODES = new Set([
  'ERR_MODULE_NOT_FOUND',
  'ERR_IMPORT_ATTRIBUTE_MISSING',
  'ERR_UNKNOWN_FILE_EXTENSION',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING',
  'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX',
  'ERR_REQUIRE_ESM',
  'ERR_PACKAGE_IMPORT_NOT_DEFINED',
  'ERR_PACKAGE_PATH_NOT_EXPORTED',
])

// Anchored so an identifier ending in one of these (`myrequire`) cannot match. Only the prefix is
// fixed, as the tail varies by node version and by binding.
const CJS_GLOBAL_ERROR_RE = /^(__dirname|__filename|require|module|exports) is not defined\b/

/**
 * Whether a failed `import()` failed because the runtime would not load the file, rather than
 * because the file threw once it was running.
 *
 * A resolution failure anywhere in the imported file's static graph counts, not just one for the
 * file itself.
 *
 * @param error the error the failed `import()` rejected with
 */
export function isLoaderError (error: unknown): boolean {
  const { code } = (error ?? {}) as { code?: unknown }
  return typeof code === 'string' && LOADER_ERROR_CODES.has(code)
}

/**
 * The CJS global a failed `import()` reached for, or `undefined` if it failed for another reason.
 * Unlike {@link isLoaderError} the file was loaded and threw on its own, but jiti supplies these
 * globals so a retry is still worthwhile.
 *
 * Only covers the error raised while the module is evaluated: a `require()` inside a function
 * called later throws long after the import settled.
 *
 * @param error the error the failed `import()` rejected with
 */
export function getMissingCjsGlobal (error: unknown): string | undefined {
  const { name, message } = (error ?? {}) as { name?: unknown, message?: unknown }
  if (name !== 'ReferenceError' || typeof message !== 'string') {
    return undefined
  }
  return CJS_GLOBAL_ERROR_RE.exec(message)?.[1]
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const
const declaredJitiCache = new Map<string, boolean>()
const nuxtJitiCache = new Map<string, boolean>()
const reportedFallbacks = new Set<string>()

/**
 * Whether to tell the user that `filePath` was loaded through jiti rather than by the runtime, and
 * record that they have been told.
 *
 * Returns `true` at most once per file, so a dev server reloading a config does not repeat itself.
 * Silent only where jiti is not something the project could lose.
 *
 * @param filePath the file that had to be loaded through jiti
 * @param rootDir project root, where the search for a declared `jiti` starts
 * @param compatibilityVersion resolved `future.compatibilityVersion`
 */
export function shouldReportJitiFallbackOnce (filePath: string, rootDir: string, compatibilityVersion: number): boolean {
  if (reportedFallbacks.has(filePath) || jitiIsGuaranteed(rootDir, compatibilityVersion)) {
    return false
  }
  reportedFallbacks.add(filePath)
  return true
}

function jitiIsGuaranteed (rootDir: string, compatibilityVersion: number): boolean {
  if (declaresJiti(rootDir)) {
    return true
  }
  // Nuxt 4 depends on jiti, so a project on its defaults cannot lose it. Asking for the v5 defaults
  // is asking for the Nuxt that will not.
  return compatibilityVersion < 5 && nuxtDependsOnJiti(rootDir)
}

function readDependencies (path: string): Record<string, Record<string, string> | undefined> | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    // an unreadable or missing `package.json` says nothing either way
    return undefined
  }
}

// Walks to the filesystem root, so that a monorepo declaring `jiti` once for every package in the
// workspace counts as having opted in
function declaresJiti (dir: string): boolean {
  let declared = declaredJitiCache.get(dir)
  if (declared === undefined) {
    declared = false
    for (let current = dir, parent = dirname(dir); ; current = parent, parent = dirname(current)) {
      const pkg = readDependencies(join(current, 'package.json'))
      if (DEPENDENCY_FIELDS.some(field => !!pkg?.[field]?.jiti)) {
        declared = true
        break
      }
      if (parent === current) {
        break
      }
    }
    declaredJitiCache.set(dir, declared)
  }
  return declared
}

function nuxtDependsOnJiti (dir: string): boolean {
  let depends = nuxtJitiCache.get(dir)
  if (depends === undefined) {
    const from = directoryToURL(dir)
    const path = resolveModulePath('nuxt/package.json', { from, try: true }) ?? resolveModulePath('nuxt-nightly/package.json', { from, try: true })
    depends = !!path && !!readDependencies(path)?.dependencies?.jiti
    nuxtJitiCache.set(dir, depends)
  }
  return depends
}

export interface LoadJitiOptions {
  /** Project root, used to look for a project-level `jiti` and to run the install in. */
  rootDir: string
  /** Additional directories to look for a project-level `jiti` in, typically `modulesDir`. */
  searchPaths?: string[]
  /**
   * Offer to install `jiti` when it cannot be found. Set to `false` where a caller can carry on
   * without it.
   * @default true
   */
  install?: boolean
}

let cached: Promise<JitiModule | undefined> | undefined

/**
 * Load the `jiti` module, or return `undefined` when it is unavailable.
 *
 * `jiti` is an optional peer dependency, needed only where the runtime cannot load a file itself.
 * It is looked for in three places, in order, so that a project which already has `jiti` never
 * sees a prompt:
 *
 * 1. Resolvable from `@nuxt/kit` — the optional peer dependency, and how a package manager
 *    satisfies it when the project (or `nuxt` itself, on v3 and v4) depends on `jiti`.
 * 2. Resolvable from the project, or from `nuxt` itself. A project depends on `nuxt` rather than
 *    on what `nuxt` depends on, so under an isolated `node_modules` the `jiti` that Nuxt 3 and 4
 *    install is reachable only by hopping through `nuxt`.
 * 3. Installed on request, if `install` is not disabled.
 *
 * A successful load is cached for the lifetime of the process; a failure is not, so a later call
 * with different search paths can still succeed. The in-flight promise is shared so that
 * concurrent callers cannot each trigger an install prompt.
 */
export function loadJiti (options: LoadJitiOptions): Promise<JitiModule | undefined> {
  return cached ??= resolveJiti(options).then((mod) => {
    if (!mod) {
      cached = undefined
    }
    return mod
  }, (error) => {
    cached = undefined
    throw error
  })
}

async function resolveJiti (options: LoadJitiOptions): Promise<JitiModule | undefined> {
  const resolved = await importFromKit() ?? await importFromProject(options)
  if (resolved) {
    return resolved
  }

  if (options.install === false) {
    return undefined
  }

  const installed = await ensureDependencyInstalled('jiti', {
    rootDir: options.rootDir,
    searchPaths: options.searchPaths,
    from: import.meta.url,
  })
  if (!installed) {
    return undefined
  }

  return await importFromKit() ?? await importFromProject(options)
}

function importFromKit (): Promise<JitiModule | undefined> {
  return import('jiti').catch(() => undefined)
}

async function importFromProject (options: LoadJitiOptions): Promise<JitiModule | undefined> {
  const path = resolveFromProject(options)
  if (!path) {
    return undefined
  }

  return await import(pathToFileURL(path).href).catch(() => undefined) as JitiModule | undefined
}

function resolveFromProject (options: LoadJitiOptions): string | undefined {
  const from = [options.rootDir, ...options.searchPaths ?? []]
    .map(dir => directoryToURL(dir.replace(/[/\\]node_modules[/\\]?$/, '')))

  const direct = resolveModulePath('jiti', { from, try: true })
  if (direct) {
    return direct
  }

  const nuxt = resolveModulePath('nuxt', { from, try: true }) ?? resolveModulePath('nuxt-nightly', { from, try: true })
  if (!nuxt) {
    return undefined
  }
  // `resolveModulePath` follows the specifier as written, so a `nuxt` reached through a symlinked
  // `node_modules` entry has to be realpath'd before its own dependencies are visible
  let realNuxt: string
  try {
    realNuxt = realpathSync(nuxt)
  } catch {
    return undefined
  }
  return resolveModulePath('jiti', { from: pathToFileURL(realNuxt), try: true })
}
