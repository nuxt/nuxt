import { createRequire } from 'node:module'
import { dirname, normalize } from 'pathe'

export function getModulePaths (paths?: string | string[]): string[] {
  return ([] as Array<string | undefined>)
    .concat(
      global.__NUXT_PREPATHS__,
      paths,
      process.cwd(),
      global.__NUXT_PATHS__
    )
    .filter(Boolean) as string[]
}

const _require = createRequire(process.cwd())

function resolveModule (id: string, paths?: string | string[]) {
  return normalize(_require.resolve(id, { paths: getModulePaths(paths) }))
}

function requireModule (id: string, paths?: string | string[]) {
  return _require(resolveModule(id, paths))
}

export function tryRequireModule (id: string, paths?: string | string[]) {
  try { return requireModule(id, paths) } catch { return null }
}

export function getNearestPackage (id: string, paths?: string | string[]) {
  while (dirname(id) !== id) {
    try { return requireModule(id + '/package.json', paths) } catch {}
    id = dirname(id)
  }
  return null
}
