import type { Nuxt } from '@nuxt/schema'
import type { parseAndWalk } from 'oxc-walker'
import type { ParsedStaticImport } from 'mlly'

type Awaitable<T> = T | Promise<T>

export interface ScanPluginHandlerContext {
  /** The identifier of the file being scanned. (usually the file path) */
  id: string
  /** The string contents of the file being scanned. */
  code: string
  /** The global Nuxt instance. */
  nuxt: Nuxt
  /** A map of auto-imported identifiers to their source module. */
  autoImportsToSources: Map<string, string>
}

/** A context object scoped to the current file, shared across all plugins that scan it. */
export interface ScanPluginHandlerThisContext {
  /** A shared walk function from `oxc-walker` that re-uses the same AST in all plugins for the same file. */
  walkParsed: (options: Parameters<typeof parseAndWalk>[2]) => ReturnType<typeof parseAndWalk>
  /** A shared utility to get the parsed static imports that re-uses the same result in all plugins for the same file. */
  getParsedStaticImports: () => ParsedStaticImport[]
}

type ScanPluginHandler = (this: ScanPluginHandlerThisContext, ctx: ScanPluginHandlerContext) => Awaitable<void>

type FilterPattern = string | RegExp | Array<string | RegExp>
type ScanPluginPatternFilter =
  | { include: FilterPattern, exclude?: FilterPattern }
  | { include?: FilterPattern, exclude: FilterPattern }

export type ScanPluginFilter<T = string> = ((input: T) => boolean) | ScanPluginPatternFilter

export interface ScanPlugin {
  name: string
  filter?: {
    /** Filter the files by their identifier. */
    id?: ScanPluginFilter
    /** Filter the files by their contents. */
    code?: ScanPluginFilter
  }
  scan: ScanPluginHandler
  /** Called after the scan is complete. */
  afterScan?: (nuxt: Nuxt) => Awaitable<void>
}
