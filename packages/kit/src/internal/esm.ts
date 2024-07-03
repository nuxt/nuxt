import { pathToFileURL } from 'node:url'
import { interopDefault, resolvePathSync } from 'mlly'

export interface ResolveModuleOptions {
  paths?: string | string[]
}

/**
 * Resolve a module from a given root path using an algorithm patterned on
 * the upcoming `import.meta.resolve`. It returns a file URL
 *
 * @internal
 */
export function tryResolveModule (id: string, url: string | string[] = import.meta.url) {
  try {
    return resolvePathSync(id, { url })
  } catch {
    // intentionally empty as this is a `try-` function
  }
}

export function resolveModule (id: string, options?: ResolveModuleOptions) {
  return resolvePathSync(id, { url: options?.paths ?? [import.meta.url] })
}

export interface ImportModuleOptions extends ResolveModuleOptions {
  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean
}

export async function importModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  const resolvedPath = await resolveModule(id, opts)
  return import(pathToFileURL(resolvedPath).href).then(r => opts?.interopDefault !== false ? interopDefault(r) : r) as Promise<T>
}

export function tryImportModule<T = unknown> (id: string, opts?: ImportModuleOptions) {
  try {
    return importModule<T>(id, opts).catch(() => undefined)
  } catch {
    // intentionally empty as this is a `try-` function
  }
}
