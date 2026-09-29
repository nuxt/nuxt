import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolveModulePath, resolveModuleURL } from 'exsolve'
import { directoryToURL } from './esm.ts'
import { tryUseNuxt } from '../context.ts'
import { kitDiagnostics } from '../diagnostics/kit-api.ts'

export interface ResolveModuleExportNamesOptions {
  extensions?: string[]
  /** File URL(s) to resolve `id` from. */
  url?: string | URL | Array<string | URL>
}

/**
 * Resolve the names a module exports, following `export * from '...'` re-exports.
 *
 * Type-only exports are omitted; a default export is returned as `default`.
 *
 * @internal
 */
export async function resolveModuleExportNames (id: string, options: ResolveModuleExportNamesOptions = {}): Promise<string[]> {
  const parser = await loadParser()

  if ('resolveModuleExportNames' in parser) {
    return parser.resolveModuleExportNames(id, options as Parameters<typeof parser.resolveModuleExportNames>[1])
  }

  const names = new Set<string>()
  await collectExportNames(parser.parseSync, id, options, names, new Set())
  return [...names]
}

async function collectExportNames (parseSync: Parser['parseSync'], id: string, options: ResolveModuleExportNamesOptions, names: Set<string>, seen: Set<string>) {
  const path = resolveModulePath(id, {
    from: options.url ?? [import.meta.url],
    extensions: options.extensions,
    try: true,
  })

  if (!path || seen.has(path)) {
    return
  }
  seen.add(path)

  const { module } = parseSync(path, await readFile(path, 'utf8'))

  const starExports: string[] = []
  for (const statement of module.staticExports) {
    for (const entry of statement.entries) {
      if (entry.isType) {
        continue
      }
      if (entry.exportName.kind === 'Default') {
        names.add('default')
      } else if (entry.exportName.kind === 'Name' && entry.exportName.name) {
        names.add(entry.exportName.name)
      } else if (entry.importName.kind === 'AllButDefault' && entry.moduleRequest) {
        starExports.push(entry.moduleRequest.value)
      }
    }
  }

  const url = pathToFileURL(path)
  for (const specifier of starExports) {
    await collectExportNames(parseSync, specifier, { ...options, url }, names, seen)
  }
}

type Parser = Pick<typeof import('rolldown/utils'), 'parseSync'>
type Fallback = Pick<typeof import('mlly'), 'resolveModuleExportNames'>

/**
 * Packages able to list a module's exports, in order of preference. `rolldown/utils` re-exports
 * `oxc-parser`'s parser, so `nuxt` has shipped one of the two since v3.16; `mlly` covers the
 * versions before that, where it is a direct dependency of `nuxt`.
 */
const PARSER_SPECIFIERS = ['rolldown/utils', 'oxc-parser', 'mlly']

let parser: Parser | Fallback | undefined

/**
 * Load the first of {@link PARSER_SPECIFIERS} that can be resolved.
 *
 * All of them are optional peer dependencies of `@nuxt/kit`, so if none is visible to kit itself
 * we look them up from the `nuxt` installation the project resolves to, and then from its root.
 */
async function loadParser (): Promise<Parser | Fallback> {
  if (parser) {
    return parser
  }

  const rootDir = tryUseNuxt()?.options.rootDir
  const rootURL = rootDir ? directoryToURL(rootDir) : undefined
  const from = [
    rootURL && resolveModuleURL('nuxt', { from: rootURL, try: true }),
    rootURL,
  ].filter((v): v is string | URL => !!v)

  for (const specifier of PARSER_SPECIFIERS) {
    const path = from.length ? resolveModulePath(specifier, { from, try: true }) : undefined
    try {
      parser = await import(path ? pathToFileURL(path).href : specifier) as Parser | Fallback
      return parser
    } catch {
      // try the next package; if none can be loaded we throw below
    }
  }

  throw kitDiagnostics.NUXT_B8022({ specifiers: PARSER_SPECIFIERS.join('` or `') })
}
