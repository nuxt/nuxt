import { fileURLToPath, pathToFileURL } from 'node:url'
import { interopDefault } from 'mlly'
import { resolveModulePath } from 'exsolve'
import { createJiti } from 'jiti'
import { captureStackTrace } from 'errx'

export interface ResolveModuleOptions {
  /** @deprecated use `url` with URLs pointing at a file - never a directory */
  paths?: string | string[]
  url?: URL | URL[]
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

export function resolveModule (id: string, options?: ResolveModuleOptions) {
  return resolveModulePath(id, {
    from: options?.url ?? options?.paths ?? [import.meta.url],
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
  })
}

export interface ImportModuleOptions extends ResolveModuleOptions {
  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

export async function importModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  const resolvedPath = resolveModule(id, opts)
  return await import(pathToFileURL(resolvedPath).href).then(r => opts?.interopDefault !== false ? interopDefault(r) : r) as Promise<T>
}

export function tryImportModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  try {
    return importModule<T>(id, opts).catch(() => undefined)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}

const warnings = new Set<string>()

/**
 * @deprecated Please use `importModule` instead.
 */
export function requireModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  const { source, line, column } = captureStackTrace().find(entry => entry.source !== import.meta.url) ?? {}
  const explanation = source ? ` (used at \`${fileURLToPath(source)}:${line}:${column}\`)` : ''
  const warning = `[@nuxt/kit] \`requireModule\` is deprecated${explanation}. Please use \`importModule\` instead.`
  if (!warnings.has(warning)) {
    console.warn(warning)
    warnings.add(warning)
  }
  const resolvedPath = resolveModule(id, opts)
  const jiti = createJiti(import.meta.url, {
    interopDefault: opts?.interopDefault !== false,
  })
  return jiti(pathToFileURL(resolvedPath).href) as T
}

/**
 * @deprecated Please use `tryImportModule` instead.
 */
export function tryRequireModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  try {
    return requireModule<T>(id, opts)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}
