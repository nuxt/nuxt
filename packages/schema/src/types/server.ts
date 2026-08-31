/**
 * Extension point through which the configured `server.builder` contributes the type of the
 * request event its runtime hands to the app layer.
 *
 * `@nuxt/nitro-server` declares `event` here as h3's `H3Event` and `routeRules` as its own
 * `NitroRouteRules`, and Nuxt references its
 * declarations from the generated `.nuxt` types. Declaring the event where it is constructed
 * keeps the resolved shape accurate without the app layer depending on a server runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerTypes {}

/**
 * Extension point through which the configured `server.builder` contributes the response types
 * of the routes its runtime serves.
 *
 * Keys are route patterns (as written by the server runtime, so they may contain `:param` and
 * `**` segments) and values map a lowercased HTTP method - or `default`, for handlers that
 * answer every method - to the type that route resolves to.
 *
 * `@nuxt/nitro-server` declares the routes Nitro has scanned here, and Nuxt references its
 * declarations from the generated `.nuxt` types. Declaring routes where they are scanned keeps
 * `$fetch` and `useFetch` typing accurate without the app layer depending on a particular
 * server runtime.
 *
 * @example
 * ```ts
 * declare module '@nuxt/schema' {
 *   interface ServerRoutes {
 *     '/api/hello': { get: { message: string } }
 *   }
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ServerRoutes {}

/**
 * Fallback request event shape, described in web standards only. Used when no server builder
 * has contributed an event type.
 */
export interface RequestEventFallback {
  readonly req: Request
  url: URL
  readonly res: {
    status?: number
    statusText?: string
    readonly headers: Headers
  }
  readonly context: Record<string, unknown>
}

/**
 * Resolves the event type contributed to a {@link ServerTypes} registry, or
 * {@link RequestEventFallback} when the registry does not declare one. Exported for type tests;
 * not part of the public API.
 *
 * @internal
 */
export type ResolveRequestEvent<T> = T extends { event: infer E } ? E : RequestEventFallback

/**
 * The request event handed to server-side composables such as `useRequestEvent()`, as declared
 * by the configured `server.builder`, or {@link RequestEventFallback} when none has declared it.
 */
export type RequestEvent = ResolveRequestEvent<ServerTypes>

/**
 * The route rules the app layer reads, as compiled into the route-rules matcher: keys the
 * server builder resolves for itself (headers, caching, proxying, and so on) are not part of
 * it, and rules the app layer normalises are described in their normalised form.
 *
 * A server builder contributes its own rules through the `routeRules` key of a
 * {@link ServerTypes} registry, and they are resolved into {@link AppRouteRules}.
 */
export interface AppRouteRulesBase {
  /** Whether the matched route is prerendered. */
  prerender?: boolean
  /** Path the matched route redirects to. */
  redirect?: string
  /** Whether a payload is cached for the matched route. */
  payload?: boolean
  /** Named app middleware to run (`true`) or skip (`false`) for the matched route. */
  appMiddleware?: Record<string, boolean>
  /** Whether the matched route is rendered on the server. */
  ssr?: boolean
  /** Whether the matched route is rendered without any scripts. */
  noScripts?: boolean
}

/**
 * Extension point for app-facing route rules that are not known statically, such as
 * `appLayout`, whose values Nuxt generates from the layouts it has scanned.
 *
 * Rules declared here take precedence over those the server builder contributes, so they
 * describe the value the app layer reads rather than the value the server was configured
 * with.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AppRouteRulesExtensions {}

/**
 * Resolves the route rules contributed to a {@link ServerTypes} registry against the
 * app-facing rules, which win where both describe a rule. Exported for type tests; not part
 * of the public API.
 *
 * @internal
 */
export type ResolveAppRouteRules<T> = AppRouteRulesBase & AppRouteRulesExtensions & (T extends { routeRules: infer R } ? Omit<R, keyof AppRouteRulesBase | keyof AppRouteRulesExtensions> : unknown)

/**
 * The route rules matched for a route in the app, combining the rules the app layer itself
 * reads with those declared by the configured `server.builder`.
 */
export type AppRouteRules = ResolveAppRouteRules<ServerTypes>
