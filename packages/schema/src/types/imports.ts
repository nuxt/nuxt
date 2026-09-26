import type { BuiltinPresetName } from 'unimport'

/**
 * Names of the auto-import presets shipped by `unimport`, such as `'vue'` or `'vue-router'`.
 *
 * The list belongs to `unimport`, which is handed `imports.presets` unchanged, so it is
 * re-exported rather than reimplemented: a name Nuxt made up would be a name that resolves to
 * nothing at build time.
 */
export type NuxtImportPresetName = BuiltinPresetName

/** How an auto-imported binding is declared in generated type declarations. */
export type NuxtImportDeclarationType = 'let' | 'var' | 'const' | 'enum' | 'const enum' | 'class' | 'function' | 'async function'

/** Options shared between a single auto-import and a preset of auto-imports. */
export interface NuxtImportCommon {
  /** Module specifier the import is resolved from. */
  from: string
  /**
   * Priority of the import. Where two imports share a name, the higher priority wins.
   * @default 1
   */
  priority?: number
  /** Whether this import is disabled. */
  disabled?: boolean
  /** Whether to omit this import from generated type declarations. */
  dtsDisabled?: boolean
  /** How the binding is declared in generated type declarations. */
  declarationType?: NuxtImportDeclarationType
  meta?: {
    /** Short description of the import, shown in editor tooling. */
    description?: string
    /** URL to documentation for the import. */
    docsUrl?: string
    [key: string]: any
  }
  /** Whether this import is a type-only import. */
  type?: boolean
  /** Module specifier to use in generated type declarations, if it differs from `from`. */
  typeFrom?: string
}

/** A single auto-imported binding. */
export interface NuxtImport extends NuxtImportCommon {
  /** Name of the export to import. */
  name: string
  /** Name to make the export available as, if it differs from `name`. */
  as?: string
  /** Import attributes. Ignored for CommonJS output. */
  with?: Record<string, string>
}

/**
 * An entry in a preset's `imports`: an export name, a `[name, as?, from?]` tuple, or a full
 * import without `from` (which is inherited from the preset).
 */
export type NuxtImportEntry = Omit<NuxtImport, 'from'> | string | [name: string, as?: string, from?: string]

/** A set of auto-imports declared inline, sharing a module specifier and options. */
export interface NuxtImportPreset extends NuxtImportCommon {
  imports: (NuxtImportEntry | NuxtImportPreset)[]
}

/** A set of auto-imports derived by scanning a package's exports. */
export interface NuxtPackageImportPreset {
  /** Name of the package to scan. */
  package: string
  /**
   * Path to resolve the package from.
   * @default process.cwd()
   */
  url?: string
  /** Names to exclude from the scanned exports. */
  ignore?: (string | RegExp | ((name: string) => boolean))[]
  /**
   * Use a cached scan of the package, if one is available.
   * @default true
   */
  cache?: boolean
}

/** A source of auto-imports: either declared inline, or scanned from a package. */
export type NuxtImportPresetSource = NuxtImportPreset | NuxtPackageImportPreset

/** A directory to scan for auto-imports, with per-directory options. */
export interface NuxtImportScanDir {
  /** Glob pattern matching the directory to scan. */
  glob: string
  /**
   * Register type exports found in the directory.
   * @default true
   */
  types?: boolean
}

/** Options for scanning directories for auto-imports. */
export interface NuxtImportScanOptions {
  /**
   * Glob patterns matching files to scan.
   * @default ['*.{ts,js,mjs,cjs,mts,cts,tsx,jsx}']
   */
  filePatterns?: string[]
  /** Filter the scanned files. */
  fileFilter?: (file: string) => boolean
  /**
   * Register type exports.
   * @default true
   */
  types?: boolean
  /**
   * Directory to resolve `filePatterns` against.
   * @default process.cwd()
   */
  cwd?: string
}

/**
 * Addons extending how auto-imports are injected.
 *
 * The addon protocol belongs to the transformer Nuxt uses internally, so entries in `addons`
 * are not typed here.
 */
export interface NuxtImportAddonsOptions {
  addons?: any[]
  /**
   * Auto-import inside Vue SFC `<template>` blocks.
   * @default false
   */
  vueTemplate?: boolean
  /**
   * Auto-import Vue directives used in SFC templates. Library authors should set
   * `meta.vueDirective` on the import; `isDirective` is consulted for local directives only.
   */
  vueDirectives?: true | {
    isDirective?: (from: string, importEntry: NuxtImport) => boolean
  }
}

export interface ImportsOptions {
  /**
   * Enable implicit auto import from Vue, Nuxt and module contributed utilities.
   * Generate global TypeScript definitions.
   */
  autoImport?: boolean

  /**
   * Directories to scan for auto imports.
   * @see https://nuxt.com/docs/4.x/directory-structure/app/composables#how-files-are-scanned
   */
  dirs?: string[]

  /**
   * Enabled scan for local directories for auto imports.
   * When this is disabled, `dirs` options will be ignored.
   */
  scan?: boolean

  /**
   * Assign auto imported utilities to `globalThis` instead of using built time transformation.
   */
  global?: boolean

  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }

  /**
   * Add polyfills for setInterval, requestIdleCallback, and others
   */
  polyfills?: boolean

  /** Auto-imports to register. */
  imports?: NuxtImport[]

  /** Presets of auto-imports to register, either declared inline or named. */
  presets?: (NuxtImportPresetSource | NuxtImportPresetName)[]

  /** Options for scanning `dirs`. */
  dirsScanOptions?: NuxtImportScanOptions

  /** Addons extending how auto-imports are injected. */
  addons?: NuxtImportAddonsOptions | any[]

  /**
   * Virtual modules exposing every registered auto-import.
   * @default ['#imports']
   */
  virtualImports?: string[]

  /** Resolve the module specifier an auto-import is imported from. */
  resolveId?: (id: string, importee?: string) => string | void | Promise<string | void>

  /**
   * Magic comments that opt a file out of auto-import injection.
   * @default ['@unimport-disable', '@imports-disable']
   */
  commentsDisable?: string[]

  /**
   * Magic comments that log auto-import injection for a file.
   * @default ['@unimport-debug', '@imports-debug']
   */
  commentsDebug?: string[]

  /** Collect metadata for each auto-import. */
  collectMeta?: boolean

  /** Inject imports at the end of the file rather than in place. */
  injectAtEnd?: boolean

  /** Merge injected imports into existing import statements for the same module. */
  mergeExisting?: boolean

  /** Parser used to detect identifiers in need of an auto-import. */
  parser?: 'acorn' | 'oxc' | 'regex'

  /** Warn about auto-import conflicts and other recoverable problems. */
  warn?: (message: string) => void

  /** Log auto-import injection details. */
  debugLog?: (message: string) => void
}
