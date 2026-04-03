import { resolvePackageJSON } from 'pkg-types'
import { resolveModulePath } from 'exsolve'
import { dirname } from 'pathe'
import { directoryToURL, tryUseNuxt } from '@nuxt/kit'

export async function resolveTypePath (path: string, subpath: string, searchPaths = tryUseNuxt()?.options.modulesDir) {
  try {
    const r = resolveModulePath(path, {
      from: searchPaths?.map(d => directoryToURL(d)),
      conditions: ['types', 'import', 'require'],
      extensions: ['.js', '.mjs', '.ts', '.cjs', '.tsx', '.jsx', '.mts', '.cts'],
    })
    if (subpath) {
      return r.replace(/(?:\.d)?\.[mc]?[jt]s$/, '')
    }
    const rootPath = await resolvePackageJSON(r)
    return dirname(rootPath)
  } catch {
    return null
  }
}
