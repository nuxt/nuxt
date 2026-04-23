import { resolvePackageJSON } from 'pkg-types'
import { resolveModulePath } from 'exsolve'
import { dirname } from 'pathe'
import { directoryToURL } from '@nuxt/kit'

const TYPE_RESOLVE_OPTIONS = {
  conditions: ['types', 'import', 'require'] as string[],
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
}

const rootCache = new Map<string, Promise<string | undefined>>()

function resolveRoot (basePkg: string, from: Array<string | URL> | undefined): Promise<string | undefined> {
  if (rootCache.has(basePkg)) {
    return rootCache.get(basePkg)!
  }
  const promise = _resolveRoot(basePkg, from)
  rootCache.set(basePkg, promise)
  return promise
}

async function _resolveRoot (basePkg: string, from: Array<string | URL> | undefined): Promise<string | undefined> {
  try {
    const r = resolveModulePath(basePkg, { from, ...TYPE_RESOLVE_OPTIONS })
    const rootPath = await resolvePackageJSON(r)
    return dirname(rootPath)
  } catch {
    return undefined
  }
}

const NESTED_RE = /^[^@]+\//

export async function resolveTypePaths (packages: string[], searchPaths: string[]): Promise<Array<[string, string]>> {
  const results: Array<[string, string]> = []

  const from = searchPaths.map(d => directoryToURL(d))

  await Promise.allSettled(packages.map(async (pkg) => {
    const [basePkg = pkg, sub] = NESTED_RE.test(pkg) ? pkg.split('/') : [pkg]
    const subpath = sub ? '/' + sub : ''

    const root = await resolveRoot(basePkg, from)
    if (!root) {
      return
    }

    if (!subpath) {
      return results.push([pkg, root])
    }

    const r = resolveModulePath(pkg, {
      from: directoryToURL(root),
      ...TYPE_RESOLVE_OPTIONS,
    })

    results.push([pkg, r.replace(/(?:\.d)?\.[mc]?[jt]s$/, '')])
  }))

  return results
}
