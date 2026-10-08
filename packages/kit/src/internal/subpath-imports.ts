import { isAbsolute } from 'pathe'
import { readPackageJSON } from './package-json.ts'

const NODE_MODULES_RE = /node_modules[\\/](?!\.virtual)/

/**
 * Whether `id` belongs to a package installed in `node_modules` or outside `rootDir` that maps
 * `specifier` through its own `imports` field.
 */
export async function hasOwnSubpathImport (id: string, specifier: string, rootDir: string): Promise<boolean> {
  if (!isAbsolute(id) || (!NODE_MODULES_RE.test(id) && id.includes(rootDir.replace(/\/?$/, '/')))) {
    return false
  }
  const pkg = await readPackageJSON(id).catch(() => undefined)
  return Object.keys(pkg?.imports || {}).some(key => key.includes(specifier))
}
