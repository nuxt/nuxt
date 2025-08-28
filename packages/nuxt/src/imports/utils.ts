import type { ImportPresetWithDeprecation } from '@nuxt/schema'

export type InternalImportPresetWithDeprecation = ImportPresetWithDeprecation & { __nuxt_internal?: true }

/**
 * Creates a new `ImportPresetWithDeprecation` object marked as internal to be able to warn users when they override it.
 */
export function createInternalImportPresetWithDeprecation (i: ImportPresetWithDeprecation): ImportPresetWithDeprecation {
  return Object.defineProperty(i, '__nuxt_internal', { value: true, enumerable: false })
}
