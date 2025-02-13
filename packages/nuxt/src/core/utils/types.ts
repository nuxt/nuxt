import { resolvePackageJSON } from 'pkg-types'
import { resolvePath as _resolvePath } from 'mlly'
import { dirname } from 'pathe'
import { directoryToParentURL, tryUseNuxt } from '@nuxt/kit'

export async function resolveTypePath (path: string, subpath: string, searchPaths = tryUseNuxt()?.options.modulesDir) {
  try {
    const r = await _resolvePath(path, { url: searchPaths?.map(d => directoryToParentURL(d)), conditions: ['types', 'import', 'require'] })
    if (subpath) {
      return r.replace(/(?:\.d)?\.[mc]?[jt]s$/, '')
    }
    const rootPath = await resolvePackageJSON(r)
    return dirname(rootPath)
  } catch {
    return null
  }
}
