/**
 * Minimal structural types for the route rules accepted by this package, covering the nitro
 * majors supported by Nuxt.
 *
 * These are inlined (rather than imported from `nitropack`/`nitro`) so that `@nuxt/kit` does not
 * depend on either package being installed. Server registrations are typed by `@nuxt/schema`,
 * which owns them, and normalised by the configured `server.builder`.
 */

/**
 * Route rules common to both nitro majors.
 *
 * Route rules are augmentable upstream and these types are inlined, so the index signature is
 * what lets a module set a rule neither nitro declares (`ssr`, `appMiddleware`, its own).
 */
interface NitroRouteConfigBase {
  cache?: Record<string, any> | false
  headers?: Record<string, string>
  prerender?: boolean
  isr?: number | boolean | Record<string, any>
  swr?: boolean | number
  static?: boolean | number
  /** Additional route options, including framework-specific route rules. */
  [key: string]: any
}

/** Route rule shape accepted by nitro v2 (`nitropack`). */
export interface NitroRouteConfigV2 extends NitroRouteConfigBase {
  /** A plain string defaults to status `302`. */
  redirect?: string | { to: string, statusCode?: number }
  proxy?: string | ({ to: string } & Record<string, any>)
  cors?: boolean
}

/** Route rule shape accepted by nitro v3 (`nitro`). */
export interface NitroRouteConfigV3 extends NitroRouteConfigBase {
  /** A plain string defaults to status `307`. */
  redirect?: string | { to: string, status?: number } | false
  /** `false` resets a rule inherited from a less specific pattern. */
  proxy?: string | ({ to: string } & Record<string, any>) | false
  cors?: Record<string, any> | boolean
}

/**
 * A route rule accepted by either supported nitro major.
 *
 * A union rather than one merged shape, so that a rule written as an object literal has to match
 * one major as a whole and excess property checking rejects a literal mixing the two. Anything
 * valid in either is accepted, since the host's nitro major is not visible here; name
 * {@link NitroRouteConfigV2} or {@link NitroRouteConfigV3} to be held to one.
 */
export type NitroRouteConfig = NitroRouteConfigV2 | NitroRouteConfigV3
