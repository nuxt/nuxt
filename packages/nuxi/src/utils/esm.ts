import { pathToFileURL } from 'node:url'
import { interopDefault, resolvePath } from 'mlly'

export async function tryResolveModule (id: string, url = import.meta.url) {
  try {
    return await resolvePath(id, { url })
  } catch { }
}

export async function importModule (id: string, url: string | string[] = import.meta.url) {
  const resolvedPath = await resolvePath(id, { url })
  return import(pathToFileURL(resolvedPath).href).then(interopDefault)
}
