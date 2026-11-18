/**
 * The types of `nitropack` and `nitropack/types` in the server tsconfig: nitro v3's own,
 * so that an augmentation of either merges into the interface nitro v3 reads.
 */
export type * from 'nitro/types'

// TypeScript merges an augmentation made through the re-export into the symbol it finds at
// that point, which a later augmentation of `nitro/types` replaces unless one merged first
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'nitro/types' {
  interface NitroApp {}
  interface NitroRuntimeConfig {}
  interface NitroRuntimeHooks {}
}
