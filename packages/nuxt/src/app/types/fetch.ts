import type { FetchOptions, FetchRequest, FetchResponse } from 'ofetch'
import type { ServerRoutes } from '@nuxt/schema'

/** A lowercased HTTP method a server route can be registered for. */
export type ServerRouteMethod = 'get' | 'head' | 'patch' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace'

/**
 * A request accepted by Nuxt's typed `$fetch`: a route registered in {@link ServerRoutes}, any
 * non-string request `fetch` accepts, or an arbitrary string.
 *
 * Internal routes (`/_*` and `/api/_*`) are excluded from the suggested literals.
 */
export type TypedFetchRequest = Exclude<keyof ServerRoutes, `/_${string}` | `/api/_${string}`> | Exclude<FetchRequest, string> | (string & {})

/** @internal */
type HandlerOf<Route extends string, Method extends ServerRouteMethod | 'default'> = Method extends keyof ServerRoutes[MatchedServerRoutes<Route>] ? ServerRoutes[MatchedServerRoutes<Route>][Method] : never

/**
 * The type a request to `Route` resolves to, according to {@link ServerRoutes}, or `Default`
 * when the route is not registered (or is registered for other methods only).
 */
export type TypedServerResponse<Route, Default = unknown, Method extends ServerRouteMethod = ServerRouteMethod> =
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
 */
export type AvailableServerRouteMethod<Request extends TypedFetchRequest> =
  Request extends string
    ? keyof ServerRoutes[MatchedServerRoutes<Request>] extends undefined
      ? ServerRouteMethod
      : Extract<keyof ServerRoutes[MatchedServerRoutes<Request>], 'default'> extends undefined
        ? Extract<ServerRouteMethod, keyof ServerRoutes[MatchedServerRoutes<Request>]>
        : ServerRouteMethod
    : ServerRouteMethod

/** Options accepted by Nuxt's typed `$fetch`, narrowing `method` to the route's methods. */
export interface TypedFetchOptions<Request extends TypedFetchRequest, Method extends AvailableServerRouteMethod<Request> = AvailableServerRouteMethod<Request>> extends FetchOptions {
  method?: Uppercase<Method> | Method
}

/** @internal */
type ExtractedRouteMethod<Request extends TypedFetchRequest, Options extends TypedFetchOptions<Request>> =
  Options extends undefined
    ? 'get'
    : Lowercase<Exclude<Options['method'], undefined>> extends ServerRouteMethod
      ? Lowercase<Exclude<Options['method'], undefined>>
      : 'get'

/**
 * The callable part of {@link TypedFetch}, without `raw` and `create`.
 *
 * @internal
 */
export type TypedFetchFunction<DefaultT = unknown, DefaultR extends TypedFetchRequest = TypedFetchRequest> = <
  T = DefaultT,
  R extends TypedFetchRequest = DefaultR,
  O extends TypedFetchOptions<R> = TypedFetchOptions<R>,
>(request: R, opts?: O) => Promise<TypedServerResponse<R, T, TypedFetchOptions<R> extends O ? 'get' : ExtractedRouteMethod<R, O>>>

/**
 * A `fetch` implementation whose responses are typed from the routes registered in
 * {@link ServerRoutes}.
 */
export interface TypedFetch<DefaultT = unknown, DefaultR extends TypedFetchRequest = TypedFetchRequest> extends TypedFetchFunction<DefaultT, DefaultR> {
  raw<T = DefaultT, R extends TypedFetchRequest = DefaultR, O extends TypedFetchOptions<R> = TypedFetchOptions<R>>(request: R, opts?: O): Promise<FetchResponse<TypedServerResponse<R, T, TypedFetchOptions<R> extends O ? 'get' : ExtractedRouteMethod<R, O>>>>
  create<T = DefaultT, R extends TypedFetchRequest = DefaultR>(defaults: FetchOptions): TypedFetch<T, R>
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
