import { promises as fsp } from 'node:fs'
import { resolveModulePath } from 'exsolve'
import { lookupNodeModuleSubpath, parseNodeModulePath } from 'mlly'
import { dirname, join } from 'pathe'
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

const rootCache = new Map<string, Promise<string | undefined>>()

function resolveRoot (basePkg: string, from: Array<string | URL>): Promise<string | undefined> {
  if (rootCache.has(basePkg)) {
    return rootCache.get(basePkg)!
  }
  const promise = (async () => {
    try {
      const r = resolveModulePath(basePkg, { from, ...TYPE_RESOLVE_OPTIONS })
      return dirname(await resolvePackageJSON(r))
    } catch {
      return undefined
    }
  })()
  rootCache.set(basePkg, promise)
  return promise
}

/**
 * Resolve auto-import / `tsConfig.paths` entries to the path TypeScript should load types from.
 *
 * Each package specifier (a base package, a subpath export, or either of those scoped) resolves to:
 * - the declaration sibling of its resolved entry, when one exists adjacent to the runtime file; or
 * - the package root, when the entry maps to the package's `.` export and has no adjacent declaration,
 *   so TypeScript resolves through the package's `exports` / `types`.
 *
 * Returns `[specifier, absolutePath]` pairs, omitting any specifier that cannot be resolved.
 */
export async function resolveTypePaths (packages: string[], searchPaths: string[]): Promise<Array<[string, string]>> {
  const results: Array<[string, string]> = []
  const from = searchPaths.map(d => directoryToURL(d))

  await Promise.allSettled(packages.map(async (pkg) => {
    const resolved = resolveModulePath(pkg, { from, try: true, ...TYPE_RESOLVE_OPTIONS })
    if (!resolved) {
      return
    }

    const declaration = await resolveDeclarationPath(resolved)
    const subpath = await lookupNodeModuleSubpath(resolved)

    // A runtime path that `resolveDeclarationPath` could not rewrite to a declaration
    // resolves to `any` as a file path. For the package's `.` export, fall back to the
    // package root, which resolves through `exports` / `types`; for other subpaths there
    // is no better path, so keep the resolved file.
    if (declaration === resolved && RUNTIME_EXT_RE.test(resolved) && (!subpath || subpath === './')) {
      const { dir, name } = parseNodeModulePath(resolved)
      const root = dir && name ? join(dir, name) : await resolveRoot(pkg, from)
      return results.push([pkg, root ?? resolved])
    }

    results.push([pkg, declaration])
  }))

  return results
}
