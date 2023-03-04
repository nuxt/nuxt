import type { UnimportOptions } from 'unimport'

export interface ImportsOptions extends UnimportOptions {
  /**
   * Enable implicit auto import from Vue, Nuxt and module contributed utilities.
   * Generate global TypeScript definitions.
   *
   * @default true
   */
  autoImport?: boolean

  /**
   * Directories to scan for auto imports.
   *
   * @see https://nuxt.com/docs/guide/directory-structure/composables#how-files-are-scanned
   * @default ['./composables', './utils']
   */
  dirs?: string[]

  /**
   * Assign auto imported utilities to `globalThis` instead of using built time transformation.
   *
   * @default false
   */
  global?: boolean

  transform?: {
    exclude?: RegExp[]
    include?: RegExp[]
  }
}
