/**
 * Minimal structural types for the nitro majors supported by Nuxt.
 *
 * These are inlined (rather than imported from `nitropack`/`nitro`) so that
 * `@nuxt/kit` does not depend on either package being installed and can be
 * used unchanged whichever nitro major the host Nuxt provides.
 */

type MaybeArray<T> = T | T[]

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

export interface NitroOptions {
  handlers: NitroEventHandler[]
  devHandlers: NitroDevEventHandler[]
  runtimeConfig: Record<string, any>
  plugins: string[]
  alias: Record<string, string>
  virtual: Record<string, any>
  publicAssets: Array<Record<string, any>>
  prerender: Record<string, any>
  output: Record<string, any>
  storage?: Record<string, any>
  devStorage?: Record<string, any>
  static?: boolean
  node?: boolean
  baseURL?: string
  preset?: string
}

export interface Nitro {
  meta: {
    version: string
    majorVersion: number
  }
  options: NitroOptions
  scannedHandlers: NitroEventHandler[]
  vfs: Record<string, string> | Map<string, { render: () => string | Promise<string> }>
  hooks: {
    hook: (...args: any[]) => () => void
    hookOnce: (...args: any[]) => () => void
    callHook: (...args: any[]) => void | Promise<any>
    addHooks: (...args: any[]) => () => void
    removeHook: (...args: any[]) => void
  }
  logger: {
    log: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
  } & Record<string, any>
  /** Only available on nitro v3. */
  fetch?: (input: Request) => Response | Promise<Response>
  /** Only available on nitro v3. */
  routing?: {
    sync: () => void
    routeRules: { routes: Array<{ route: string, data: Record<string, any> }> }
  } & Record<string, any>
  /** Only available on nitro v2. */
  storage?: unknown
  unimport?: unknown
  updateConfig: (config: Record<string, any>) => void | Promise<void>
  close: () => Promise<void>
}
