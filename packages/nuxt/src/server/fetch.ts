import type { RequestEvent } from 'nuxt/schema'

import { createError } from '../app/error'
import type { AcceptedMethod, AnyFetchPath, AnyServerRouteMethod, TypedFetchRequest, TypedServerResponse, UnmatchedRouteArgs, ValidTypedFetchPath } from '../app/types/fetch'

/**
 * Options for {@link serverFetch}.
 *
 * @since 4.6.0
 */
export interface ServerFetchInit extends RequestInit {
  /**
   * Headers to copy from the incoming request. `true` copies `cookie` and `authorization`.
   *
   * @default true
   */
  forwardHeaders?: boolean | string[]
}

/**
 * A `Response` whose `json()` resolves to the serialised return type of the route handler.
 *
 * @since 4.6.2
 */
export interface ServerFetchResponse<T = unknown> extends Response {
  json (): Promise<T>
  clone (): ServerFetchResponse<T>
}

/** @internal */
type ServerFetchOptions<Path, Method extends string> = Omit<ServerFetchInit, 'method'> & {
  method?: Method extends AnyServerRouteMethod ? AcceptedMethod<Path, Method> : Method
}

/** @internal */
type ServerFetchPath<Path, Method extends string> = Method extends AnyServerRouteMethod ? ValidTypedFetchPath<Path, Method> : unknown

/** @internal */
type ServerFetchUnmatched<Path, Method extends string> = Method extends AnyServerRouteMethod ? UnmatchedRouteArgs<Path, Method> : []

/**
 * A string a handler returns is sent as text, so `json()` is typed only for the rest.
 *
 * @internal
 */
type ServerFetchResult<Path, Method extends string> = Method extends AnyServerRouteMethod
  ? ResponseOf<Exclude<TypedServerResponse<Path, unknown, Method>, string>>
  : Response

/**
 * `Body` is `any` where the route module does not resolve, which only the tuple form detects.
 *
 * @internal
 */
type ResponseOf<Body> = [0] extends [1 & Body]
  ? Response
  : unknown extends Body
    ? Response
    : [Body] extends [never] ? Response : ServerFetchResponse<Body>

const DEFAULT_FORWARDED_HEADERS = ['cookie', 'authorization']

/** @internal */
export function resolveServerFetchInit (event: Pick<RequestEvent, 'req'>, init: ServerFetchInit = {}): RequestInit {
  const { forwardHeaders = true, ...requestInit } = init
  const headers = new Headers(requestInit.headers)
  const names = forwardHeaders === true ? DEFAULT_FORWARDED_HEADERS : forwardHeaders || []
  for (const name of names) {
    const value = event.req.headers.get(name)
    if (value !== null && !headers.has(name)) {
      headers.set(name, value)
    }
  }
  return { ...requestInit, headers }
}

/**
 * Fetch a route of this app in-process. The path is relative to the app base URL.
 *
 * The path and method are checked against the server routes as for `$fetch`, and `json()`
 * resolves to the response type of the matching route.
 *
 * @example
 * ```ts
 * const response = await serverFetch(event, '/api/robots-rules')
 * const rules = await response.json()
 * ```
 *
 * @throws a `500` when the server builder provides no in-process fetch.
 * @since 4.6.0
 */
export function serverFetch<P extends Extract<TypedFetchRequest, string>, M extends string = 'get'> (event: Pick<RequestEvent, 'req' | 'context'>, path: P, init?: ServerFetchOptions<P, M>, ...unmatched: ServerFetchUnmatched<P, M>): Promise<ServerFetchResult<P, M>>
/**
 * Fetch a route of this app in-process. The path is relative to the app base URL.
 *
 * The path and method are checked against the server routes as for `$fetch`, and `json()`
 * resolves to the response type of the matching route.
 *
 * @throws a `500` when the server builder provides no in-process fetch.
 * @since 4.6.0
 */
export function serverFetch<P extends AnyFetchPath, M extends string = 'get'> (event: Pick<RequestEvent, 'req' | 'context'>, path: P & ServerFetchPath<P, M>, init?: ServerFetchOptions<P, M>): Promise<ServerFetchResult<P, M>>
export function serverFetch (_event: Pick<RequestEvent, 'req' | 'context'>, path: string, _init?: ServerFetchInit): Promise<Response> {
  return Promise.reject(createError({
    status: 500,
    message: `\`serverFetch('${path}')\` is not supported by the configured server builder.`,
  }))
}
