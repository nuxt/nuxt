import { parseNodeModulePath } from '@nuxt/kit/internal'
import { isAbsolute, normalize, relative } from 'pathe'

/**
 * Key a component file is loaded under, shared by its server marker and the client manifest:
 * - `/`-prefixed root-relative path inside `root`
 * - `<package>/<subpath>` inside `node_modules`
 * - else relative to `root`.
 */
export function toChunkRef (filePath: string, root: string): string {
  const { name, subpath } = parseNodeModulePath(filePath)
  if (name && subpath) { return name + subpath.slice(1) }
  const rel = relative(root, normalize(filePath))
  return rel.startsWith('../') || isAbsolute(rel) ? rel : `/${rel}`
}
