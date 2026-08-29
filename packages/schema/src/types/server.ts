/**
 * Extension point through which the configured `server.builder` contributes the type of the
 * request event its runtime hands to the app layer.
 *
 * `@nuxt/nitro-server` declares `event` here as h3's `H3Event`, and Nuxt references its
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
