import { promises as fsp } from 'node:fs'
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

// TS's `paths` substitution only retries `.ts / .tsx / .d.ts / .js / .jsx`
// when the substitution is extensionless, so `.d.mts` / `.d.cts` are preserved
// and `.mjs` / `.cjs` / `.mts` / `.cts` are rewritten to a sibling declaration
// when one exists.
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/moduleNameResolver.ts
const STRIPPABLE_EXT_RE = /\b\.(?:d\.ts|tsx?|jsx?)$/
const RUNTIME_EXT_RE = /\.([cm])(?:ts|js)$/

async function resolveDeclarationPath (absolutePath: string): Promise<string> {
  const stripped = absolutePath.replace(STRIPPABLE_EXT_RE, '')
  if (stripped !== absolutePath) {
    return stripped
  }
  const runtimeMatch = absolutePath.match(RUNTIME_EXT_RE)
  if (runtimeMatch) {
    const base = absolutePath.slice(0, -runtimeMatch[0]!.length)
    if (await fsp.stat(`${base}.d.ts`).then(s => s.isFile(), () => false)) {
      return base
    }
    const declaration = `${base}.d.${runtimeMatch[1]}ts`
    if (await fsp.stat(declaration).then(s => s.isFile(), () => false)) {
      return declaration
    }
  }
  return absolutePath
}

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

    results.push([pkg, await resolveDeclarationPath(r)])
  }))

  return results
}
