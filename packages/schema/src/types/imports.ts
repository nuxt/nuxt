import type { UnimportOptions } from 'unimport'

export interface ImportsOptions extends UnimportOptions {
  /**
   * Enable implicit auto import from Vue, Nuxt and module contributed utilities.
   * Generate global TypeScript definitions.
   */
  autoImport?: boolean

  /**
   * Directories to scan for auto imports.
   * @see https://nuxt.com/docs/4.x/guide/directory-structure/composables#how-files-are-scanned
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
}
