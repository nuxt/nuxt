import { pathToFileURL } from 'node:url'
import { interopDefault } from 'mlly'
import { resolveModulePath } from 'exsolve'
import { createJiti } from 'jiti'
import { getUserCaller, warn } from './trace.ts'
import { resolveAlias } from '../resolve.ts'

export interface ResolveModuleOptions {
  /** @deprecated use `url` with URLs pointing at a file - never a directory */
  paths?: string | string[]
  url?: URL | URL[]
  /** @default ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'] */
  extensions?: string[]
}

export function directoryToURL (dir: string): URL {
  return pathToFileURL(dir + '/')
}

/**
 * Resolve a module from a given root path using an algorithm patterned on
 * the upcoming `import.meta.resolve`. It returns a file URL
 *
 * @internal
 */
export async function tryResolveModule (id: string, url: URL | URL[]): Promise<string | undefined>
/** @deprecated pass URLs pointing at files */
export function tryResolveModule (id: string, url: string | string[]): Promise<string | undefined>
export function tryResolveModule (id: string, url: string | string[] | URL | URL[] = import.meta.url) {
  return Promise.resolve(resolveModulePath(id, {
    from: url,
    suffixes: ['', 'index'],
    try: true,
  }))
}

export function resolveModule (id: string, options?: ResolveModuleOptions): string {
  return resolveModulePath(id, {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    from: options?.url ?? options?.paths ?? [import.meta.url],
    extensions: options?.extensions ?? ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  })
}

export interface ImportModuleOptions extends ResolveModuleOptions {
  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

export async function importModule<T = unknown> (id: string, opts?: ImportModuleOptions): Promise<T> {
  const resolvedPath = resolveModule(id, opts)
  return await import(pathToFileURL(resolvedPath).href).then(r => opts?.interopDefault !== false ? interopDefault(r) : r) as Promise<T>
}

export function tryImportModule<T = unknown> (id: string, opts?: ImportModuleOptions): Promise<T | undefined> | undefined {
  try {
    return importModule<T>(id, opts).catch(() => undefined)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}

/**
 * @deprecated Please use `importModule` instead.
 */
export function requireModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  const caller = getUserCaller()
  const explanation = caller ? ` (used at \`${resolveAlias(caller.source)}:${caller.line}:${caller.column}\`)` : ''
  const warning = `[@nuxt/kit] \`requireModule\` is deprecated${explanation}. Please use \`importModule\` instead.`
  warn(warning)
  const resolvedPath = resolveModule(id, opts)
  const jiti = createJiti(import.meta.url, {
    interopDefault: opts?.interopDefault !== false,
  })
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  return jiti(pathToFileURL(resolvedPath).href) as T
}

/**
 * @deprecated Please use `tryImportModule` instead.
 */
export function tryRequireModule<T = unknown> (id: string, opts?: ImportModuleOptions): T | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return requireModule<T>(id, opts)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}
