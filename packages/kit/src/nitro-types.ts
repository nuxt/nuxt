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

export interface NitroRouteConfig {
  cache?: Record<string, any> | false
  headers?: Record<string, string>
  redirect?: string | { to: string, status?: number, statusCode?: number }
  prerender?: boolean
  proxy?: string | ({ to: string } & Record<string, any>)
  isr?: number | boolean | Record<string, any>
  cors?: boolean
  swr?: boolean | number
  static?: boolean | number
  basicAuth?: Record<string, any> | false
  /** Additional route options, including framework-specific route rules. */
  [key: string]: any
}
