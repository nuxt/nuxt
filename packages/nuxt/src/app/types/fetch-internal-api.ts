import type { FetchOptions, FetchRequest } from 'ofetch'
import type { ServerRoutes } from '@nuxt/schema'
import type { ServerRouteMethod } from './fetch'

/**
 * Typing of `$fetch` and `useFetch` as it resolves under `compatibilityVersion: 4`: from the
 * response types nitro contributes to {@link ServerRoutes} through its `InternalApi` interface,
 * with no request-shape narrowing and no serialization of the response.
 *
 * Reached through the conditionals in `./fetch`, which pick this family or the generated route set
 * according to the engine the build resolved. Nothing here is part of the public API.
 */

/**
 * A request accepted by `$fetch`: a route registered in {@link ServerRoutes}, any non-string
 * request `fetch` accepts, or an arbitrary string.
 *
 * Internal routes (`/_*` and `/api/_*`) are excluded from the suggested literals.
 *
 * @internal
 */
export type InternalApiRequest = Exclude<keyof ServerRoutes, `/_${string}` | `/api/_${string}`> | Exclude<FetchRequest, string> | (string & {})

/** @internal */
type HandlerOf<Route extends string, Method extends ServerRouteMethod | 'default'> = Method extends keyof ServerRoutes[MatchedServerRoutes<Route>] ? ServerRoutes[MatchedServerRoutes<Route>][Method] : never

/**
 * The type a request to `Route` resolves to, according to {@link ServerRoutes}, or `Default`
 * when the route is not registered (or is registered for other methods only).
 *
 * @internal
 */
export type InternalApiResponse<Route, Default = unknown, Method extends ServerRouteMethod = ServerRouteMethod> =
  Default extends string | boolean | number | null | void | object
    ? Default
    : Route extends string
      ? HandlerOf<Route, Method> extends never
        ? HandlerOf<Route, 'default'> extends never
          ? Default
          : HandlerOf<Route, 'default'>
        : HandlerOf<Route, Method>
      : Default

/**
 * The methods `Request` can be fetched with: the methods registered for the matching route in
 * {@link ServerRoutes}, or every method when the route is not registered.
 *
 * @internal
 */
export type InternalApiMethods<Request> =
  Request extends string
    ? keyof ServerRoutes[MatchedServerRoutes<Request>] extends undefined
      ? ServerRouteMethod
      : Extract<keyof ServerRoutes[MatchedServerRoutes<Request>], 'default'> extends undefined
        ? Extract<ServerRouteMethod, keyof ServerRoutes[MatchedServerRoutes<Request>]>
        : ServerRouteMethod
    : ServerRouteMethod

/** The `body`, `query`, `headers` and `params` a request carries, as ofetch declares them. */
export interface InternalApiRequestShape {
  body?: FetchOptions['body']
  query?: FetchOptions['query']
  headers?: FetchOptions['headers']

  params?: FetchOptions['params']
}

/*
 * Route pattern matching, resolving a requested path to the best-matching key of
 * {@link ServerRoutes}: an exact match wins, then the most specific `:param` pattern, then a
 * `**` catch-all.
 */

/** @internal */
type MatchResult<Key extends string, Exact extends boolean = false, Score extends any[] = [], CatchAll extends boolean = false> = {
  [k in Key]: { key: k, exact: Exact, score: Score, catchAll: CatchAll }
}[Key]

/** @internal */
type Subtract<Minuend extends any[] = [], Subtrahend extends any[] = []> = Minuend extends [...Subtrahend, ...infer Remainder] ? Remainder : never

/** @internal */
type TupleIfDiff<First extends string, Second extends string, Tuple extends any[] = []> = First extends `${Second}${infer Diff}` ? (Diff extends '' ? [] : Tuple) : []

/** @internal */
type MaxTuple<N extends any[] = [], T extends any[] = []> = [N['length']] extends [Partial<T>['length']] ? T : MaxTuple<N, ['', ...T]>

/** @internal */
type CalcMatchScore<Key extends string, Route extends string, Score extends any[] = [], Init extends boolean = false, FirstKeySegMatcher extends string = (Init extends true ? ':Invalid:' : '')> =
  `${Key}/` extends `${infer KeySeg}/${infer KeyRest}`
    ? KeySeg extends FirstKeySegMatcher
      ? Subtract<[...Score, ...TupleIfDiff<Route, Key, ['', '']>], TupleIfDiff<Key, Route, ['', '']>>
      : `${Route}/` extends `${infer RouteSeg}/${infer RouteRest}`
        ? `${RouteSeg}?` extends `${infer RouteSegWithoutQuery}?${string}`
          ? RouteSegWithoutQuery extends KeySeg
            ? CalcMatchScore<KeyRest, RouteRest, [...Score, '', '']>
            : KeySeg extends `:${string}`
              ? RouteSegWithoutQuery extends ''
                ? never
                : CalcMatchScore<KeyRest, RouteRest, [...Score, '']>
              : KeySeg extends RouteSegWithoutQuery
                ? CalcMatchScore<KeyRest, RouteRest, [...Score, '']>
                : never
          : never
        : never
    : never

/** @internal */
type _MatchedServerRoutes<Route extends string, MatchedResultUnion extends MatchResult<string> = MatchResult<keyof ServerRoutes>> =
  MatchedResultUnion['key'] extends infer MatchedKeys
    ? MatchedKeys extends string
      ? Route extends MatchedKeys
        ? MatchResult<MatchedKeys, true>
        : MatchedKeys extends `${infer Root}/**${string}`
          ? MatchedKeys extends `${string}/**`
            ? Route extends `${Root}/${string}`
              ? MatchResult<MatchedKeys, false, [], true>
              : never
            : MatchResult<MatchedKeys, false, CalcMatchScore<Root, Route, [], true>>
          : MatchResult<MatchedKeys, false, CalcMatchScore<MatchedKeys, Route, [], true>>
      : never
    : never

/**
 * The score of the most specific `:param` match among candidates.
 *
 * @internal
 */
type MaxScore<Matches extends MatchResult<string>> = MaxTuple<Matches['score']>

/**
 * The keys of {@link ServerRoutes} matching a requested path. Exported for type tests; not part
 * of the public API.
 *
 * @internal
 */
export type MatchedServerRoutes<Route extends string, MatchedKeysResult extends MatchResult<string> = MatchResult<keyof ServerRoutes>, Matches extends MatchResult<string> = _MatchedServerRoutes<Route, MatchedKeysResult>> =
  Route extends '/'
    ? keyof ServerRoutes
    : Extract<Matches, { exact: true }> extends never
      ? Extract<Exclude<Matches, { score: never }>, { score: MaxScore<Matches> }>['key'] | Extract<Matches, { catchAll: true }>['key']
      : Extract<Matches, { exact: true }>['key']
