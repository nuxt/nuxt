/**
 * The types of `nitropack` and `nitropack/types` in the server tsconfig: nitro v3's own,
 * so that an augmentation of either merges into the interface nitro v3 reads.
 */
export type * from 'nitro/types'

/* eslint-disable @typescript-eslint/no-empty-object-type */

/** Route rule keys declared for Nitro v2, applied to the rules `h3/rules` types. */
export interface NitroRouteConfig {}

/** Resolved route rule keys declared for Nitro v2, applied to the rules `h3/rules` types. */
export interface NitroRouteRules extends NitroRouteConfig {}

declare module 'h3/rules' {
  interface RouteRuleConfig extends NitroRouteConfig {}
  interface RouteRules extends NitroRouteRules {}
}

// TypeScript merges an augmentation made through the re-export into the symbol it finds at
// that point, which a later augmentation of `nitro/types` replaces unless one merged first
declare module 'nitro/types' {
  interface NitroApp {}
  interface NitroRuntimeConfig {}
  interface NitroRuntimeHooks {}
}
