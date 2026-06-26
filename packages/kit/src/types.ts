import { promises as fsp } from 'node:fs'
import { resolveModulePath } from 'exsolve'
import { dirname } from 'pathe'
import { resolvePackageJSON } from 'pkg-types'
import { directoryToURL } from './internal/esm.ts'

const TYPE_RESOLVE_OPTIONS = {
  conditions: ['types', 'import', 'require'] as string[],
  extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'],
}

// TS's `paths` substitution only retries `.ts / .tsx / .d.ts / .js / .jsx`
// when the substitution is extensionless, so `.d.mts` / `.d.cts` are preserved
// and `.mjs` / `.cjs` / `.mts` / `.cts` are rewritten to a sibling declaration
// when one exists.
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/moduleNameResolver.ts
const STRIPPABLE_EXT_RE = /\b\.(?:d\.ts|tsx?|jsx?)$/
const RUNTIME_EXT_RE = /(?<!\.d)\.([cm])(?:ts|js)$/

function isFile (path: string) {
  return fsp.stat(path).then(s => s.isFile(), () => false)
}

/**
 * Rewrite a resolved module path to the declaration file TypeScript will load for it.
 *
 * A `.d.ts` / `.d.mts` / `.d.cts` or `.ts` / `.tsx` path is returned unchanged (or with
 * the extension stripped, where TypeScript's extensionless `paths` retry will find it).
 * A `.mjs` / `.cjs` / `.mts` / `.cts` runtime path is rewritten to an adjacent declaration
 * sibling when one exists; otherwise it is returned as-is for the caller to handle.
 */
export async function resolveDeclarationPath (absolutePath: string): Promise<string> {
  const stripped = absolutePath.replace(STRIPPABLE_EXT_RE, '')
  if (stripped !== absolutePath) {
    return stripped
  }
  const runtimeMatch = absolutePath.match(RUNTIME_EXT_RE)
  if (runtimeMatch) {
    const base = absolutePath.slice(0, -runtimeMatch[0]!.length)
    if (await isFile(`${base}.d.ts`)) {
      return base
    }
    const declaration = `${base}.d.${runtimeMatch[1]}ts`
    if (await isFile(declaration)) {
      return declaration
    }
  }
  return absolutePath
}

/** Extract the package name (including scope) from a (possibly subpath) module specifier. */
export function packageName (specifier: string): string {
  const segments = specifier.split('/')
  return specifier[0] === '@' ? segments.slice(0, 2).join('/') : segments[0]!
}

const rootCache = new Map<string, Promise<string | undefined>>()

function resolveRoot (basePkg: string, from: Array<string | URL>): Promise<string | undefined> {
  const cacheKey = `${basePkg}\0${from.map(String).join('\0')}`
  if (rootCache.has(cacheKey)) {
    return rootCache.get(cacheKey)!
  }
  const promise = (async () => {
    try {
      const r = resolveModulePath(basePkg, { from, ...TYPE_RESOLVE_OPTIONS })
      return dirname(await resolvePackageJSON(r))
    } catch {
      return undefined
    }
  })()
  rootCache.set(cacheKey, promise)
  return promise
}

/**
 * Resolve auto-import / `tsConfig.paths` entries to the path TypeScript should load types from.
 *
 * A bare package resolves to its package root, so TypeScript follows the package's own
 * `exports` / `types` (which may differ from the file its `.` export condition points at).
 * A subpath export resolves to its entry's declaration sibling when one exists, otherwise to
 * the resolved file itself.
 *
 * Returns `[specifier, absolutePath]` pairs, omitting any specifier that cannot be resolved.
 */
export async function resolveTypePaths (packages: string[], searchPaths: string[]): Promise<Array<[string, string]>> {
  const from = searchPaths.map(d => directoryToURL(d))

  const settled = await Promise.allSettled(packages.map(async (pkg): Promise<[string, string] | undefined> => {
    if (pkg === packageName(pkg)) {
      const root = await resolveRoot(pkg, from)
      return root ? [pkg, root] : undefined
    }

    const resolved = resolveModulePath(pkg, { from, try: true, ...TYPE_RESOLVE_OPTIONS })
    return resolved ? [pkg, await resolveDeclarationPath(resolved)] : undefined
  }))

  return settled.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
}
