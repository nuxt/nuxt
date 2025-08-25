import type { Import } from 'unimport'

export type ImportInternal = Import & { __nuxt_internal?: true }

/**
 * Creates a new `Import` object marked as an internal Nuxt entity to be able to warn users when they override it.
 */
export function createInternalImport (i: Import): Import {
  return Object.defineProperty(i, '__nuxt_internal', { value: true, enumerable: false })
}
