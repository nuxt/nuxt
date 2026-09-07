/**
 * Minimal structural types for the inputs accepted by this package's nitro utilities, covering
 * the nitro majors supported by Nuxt.
 *
 * These are inlined (rather than imported from `nitropack`/`nitro`) so that `@nuxt/kit` does not
 * depend on either package being installed, and so its utilities accept the same registrations
 * whichever nitro major the host Nuxt provides. The type of a running nitro instance is a
 * different matter: that one comes from `@nuxt/schema`, where the configured `server.builder`
 * contributes it.
 */

type MaybeArray<T> = T | T[]

/** Supported nitro majors for version-tagged server registrations. */
export type NitroCompatibilityVersion = 2 | 3

export type NitroHandlerMethod = 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE'
type NitroHandlerMethodV3 = NitroHandlerMethod | 'QUERY'

type HandlerEnv = MaybeArray<'dev' | 'prod' | 'prerender' | (string & {})>

interface NitroRouteMeta {
  openAPI?: Record<string, any>
}

/** Server handler shape accepted by nitro v2 (`nitropack`). */
export interface NitroEventHandlerV2 {
  /**
   * Path prefix or route
   *
   * If an empty string used, will be used as a middleware
   */
  route?: string
  /**
   * Specifies this is a middleware handler.
   * Middleware are called on every route and should normally return nothing to pass to the next handlers
   */
  middleware?: boolean
  /**
   * Use lazy loading to import handler
   */
  lazy?: boolean
  /**
   * Path to event handler
   */
  handler: string
  /**
   * Router method matcher
   */
  method?: NitroHandlerMethod | Lowercase<NitroHandlerMethod>
  /**
   * Meta
   */
  meta?: NitroRouteMeta
  env?: HandlerEnv
}

/** Server handler shape accepted by nitro v3 (`nitro`). */
export interface NitroEventHandlerV3 {
  /**
   * HTTP pathname pattern to match.
   *
   * @example "/test", "/api/:id", "/blog/**"
   */
  route: string
  /**
   * HTTP method to match.
   */
  method?: NitroHandlerMethodV3 | Lowercase<NitroHandlerMethodV3>
  /**
   * Run handler as a middleware before other route handlers.
   */
  middleware?: boolean
  /**
   * Route metadata (e.g. OpenAPI operation info).
   */
  meta?: NitroRouteMeta
  /**
   * Use lazy loading to import handler.
   */
  lazy?: boolean
  /**
   * Path to event handler.
   */
  handler: string
  /**
   * Event handler type.
   *
   * Default is `"web"`. If set to `"node"`, the handler will be converted into a web compatible handler.
   */
  format?: 'web' | 'node'
  /**
   * Environments to include and bundle this handler.
   */
  env?: HandlerEnv
}

export type NitroEventHandler = NitroEventHandlerV2 | NitroEventHandlerV3

/** Development-only server handler shape accepted by nitro v2 (`nitropack`). */
export interface NitroDevEventHandlerV2 {
  /**
   * Path prefix or route
   */
  route?: string
  /**
   * Event handler
   */
  handler: (...args: any[]) => any
}

/** Development-only server handler shape accepted by nitro v3 (`nitro`). */
export interface NitroDevEventHandlerV3 {
  /**
   * HTTP pathname pattern to match.
   */
  route: string
  /**
   * HTTP method to match.
   */
  method?: NitroHandlerMethodV3 | Lowercase<NitroHandlerMethodV3>
  /**
   * Run handler as a middleware before other route handlers.
   */
  middleware?: boolean
  /**
   * Route metadata (e.g. OpenAPI operation info).
   */
  meta?: NitroRouteMeta
  /**
   * Event handler function, or a fetchable object such as an `H3` app instance.
   */
  handler: ((...args: any[]) => any) | { fetch: (...args: any[]) => any } | Record<string, any>
}

export type NitroDevEventHandler = NitroDevEventHandlerV2 | NitroDevEventHandlerV3

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
