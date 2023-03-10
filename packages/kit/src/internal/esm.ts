import { pathToFileURL } from 'node:url'
import { interopDefault, resolvePath } from 'mlly'

/**
 * Resolve a module from a given root path using an algorithm patterned on
 * the upcoming `import.meta.resolve`. It returns a file URL
 *
 * @internal
 */
export async function tryResolveModule (id: string, url = import.meta.url) {
  if (!url.startsWith('file:')) {
    url = pathToFileURL(url).href
  }
  try {
    return await resolvePath(id, { url })
  } catch { }
}

export async function importModule (id: string, url = import.meta.url) {
  if (!url.startsWith('file:')) {
    url = pathToFileURL(url).href
  }
  const resolvedPath = await resolvePath(id, { url })
  return import(pathToFileURL(resolvedPath).href).then(interopDefault)
}

export function tryImportModule (id: string, url = import.meta.url) {
  if (!url.startsWith('file:')) {
    url = pathToFileURL(url).href
  }
  try {
    return importModule(id, url).catch(() => undefined)
  } catch { }
}
