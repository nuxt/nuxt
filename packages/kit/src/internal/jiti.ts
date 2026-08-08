import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolveModulePath } from 'exsolve'
import { directoryToURL } from './esm.ts'
import { ensureDependencyInstalled } from '../dependency.ts'

export type Jiti = ReturnType<typeof import('jiti')['createJiti']>
type JitiModule = typeof import('jiti')

// Errors the runtime raises when it declines to load a file, as opposed to errors the file itself
// raises once it is running. Only the former are worth retrying through jiti.
const LOADER_ERROR_CODES = new Set([
  'ERR_MODULE_NOT_FOUND',
  'ERR_UNKNOWN_FILE_EXTENSION',
  'ERR_UNSUPPORTED_DIR_IMPORT',
  'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING',
  'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX',
  'ERR_REQUIRE_ESM',
])

/**
 * Whether a failed `import()` failed because the runtime would not load the file, rather than
 * because the file threw once it was running.
 *
 * @param error the error the failed `import()` rejected with
 * @param target the URL that was imported, used to tell an unresolved import of `target` itself
 * apart from one the file made after it had started running
 */
export function isLoaderError (error: unknown, target?: string): boolean {
  const { code, url } = (error ?? {}) as { code?: unknown, url?: unknown }
  if (typeof code !== 'string' || !LOADER_ERROR_CODES.has(code)) {
    return false
  }
  // node sets `url` only when `target` itself could not be found; when a specifier inside the file
  // could not be resolved it is left unset, and the file has already run
  if (code === 'ERR_MODULE_NOT_FOUND' && target) {
    return url === target
  }
  return true
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
