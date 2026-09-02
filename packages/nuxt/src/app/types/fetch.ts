import type { FetchOptions, FetchRequest, FetchResponse } from 'ofetch'
import type { AnyHTTPMethod, LooseTypedHeaders, TypedFetchErrorBody, TypedFetchPath, TypedFetchRequestBody, TypedFetchRequestHeaders, TypedFetchRequestQuery, TypedFetchRequires, TypedFetchResponseBody, ValidFetchInput } from 'fetchdts'
import type { ErrorBody, Methods, Path, RequestBody, RequestHeaders, RequestQuery, Requires, Response, RouteTypesEngine, StrictFetchPaths, ValidInput } from '#build/server-routes'
import type { InternalApiMethods, InternalApiRequest, InternalApiRequestShape, InternalApiResponse } from './fetch-internal-api'

/**
 * Whether requests are typed from nitro's `InternalApi` interface rather than from the routes the
 * server builder reported.
 *
 * Resolved by the build and emitted with the route types: under `compatibilityVersion: 4` the
 * generated route set is written but not consulted, so `$fetch` and `useFetch` resolve exactly as
 * they did before the route compiler existed. Each type below that the two engines disagree on
 * branches on this.
 *
 * @internal
 */
type LegacyEngine = RouteTypesEngine extends 'internal-api' ? true : false

/** A lowercased HTTP method a server route can be registered for. */
export type ServerRouteMethod = 'get' | 'head' | 'patch' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace'

/**
 * A method as it may be written at a call site.
 *
 * A method type parameter has to admit both cases, or the one it does not admit cannot be inferred:
 * a parameter constrained to lowercase falls back to its default when a call passes `'POST'`, and
 * the call is rejected rather than resolved against the wrong method.
 */
export type AnyServerRouteMethod = ServerRouteMethod | Uppercase<ServerRouteMethod>

/**
 * The constraint on a path argument: a pattern while strict, so that a literal keeps its literal
 * type through `ref` and `computed`, and `string & {}` when not, which does the same and also
 * accepts a path known only at runtime.
 */
export type TypedFetchPathInput = StrictFetchPaths extends true
  ? `/${string}` | `${string}://${string}`
  : (string & {})

/**
 * The constraint on `$fetch`'s permissive signature: any string, without widening one built from a
 * template.
 *
 * Plain `string` would accept everything and is what lets `$fetch<Something>(url)` compile, but a
 * literal inferred into a parameter constrained by `string` widens - so `` `/api/posts/${id}` ``
 * arrives as `string`, matches nothing, and loses the union a parameter would have resolved to. The
 * pattern members keep the literal; `string & {}` keeps the signature total.
 */
type AnyFetchPath = `/${string}` | `${string}://${string}` | (string & {})

/**
 * `unknown` where the path resolves, where it is an absolute URL, where the request is not a
 * string, or where the app opted out; otherwise a type no string satisfies, whose single key names
 * the path and method that matched nothing.
 *
 * An absolute URL is exempt because Nuxt cannot know a third-party API's routes.
 */
export type ValidTypedFetchPath<Request, Method extends AnyServerRouteMethod> =
  StrictFetchPaths extends false
    ? unknown
    : string extends Request
      // the path is not known at this call site: either it is a runtime value, or the caller named
      // the response type explicitly (`$fetch<Foo>(url)`), which turns inference off for the request
      ? unknown
      : Request extends string
        ? Request extends `${string}://${string}`
          ? unknown
          : ValidInput<Request, Uppercase<Method>>
        : unknown

/**
 * A request accepted by Nuxt's typed `$fetch`: a route the server serves, or any non-string request
 * `fetch` accepts.
 *
 * The path union is emitted as source by the route compiler, so it needs no normalising before it
 * is used as a constraint here.
 */
export type TypedFetchRequest = LegacyEngine extends true
  ? InternalApiRequest
  : Path | Exclude<FetchRequest, string>

/**
 * The type a request to `Request` resolves to, or `Default` where no route matches.
 *
 * A `Default` the caller named explicitly wins over the route's own type, because naming it is how
 * `$fetch<Something>(url)` has always overridden the response and the request is not inferred at
 * such a call site.
 */
export type TypedServerResponse<Request, Default = unknown, Method extends AnyServerRouteMethod = 'get'> =
  LegacyEngine extends true
    ? InternalApiResponse<Request, Default, Lowercase<Method>>
    : Default extends string | boolean | number | null | void | object
      ? Default
      : Response<Request, Uppercase<Method>> extends infer Resolved
        ? [Resolved] extends [never] ? Default : Resolved
        : Default

/** The body a failed request to `Request` carries. */
export type TypedServerError<Request, Method extends AnyServerRouteMethod = 'get'> =
  ErrorBody<Request, Uppercase<Method>>

/** The methods the matching route answers, uppercased as the schema declares them. */
export type ServerRouteMethods<Request> = LegacyEngine extends true
  ? Uppercase<InternalApiMethods<Request>>
  : Methods<Request>

/**
 * The methods `Request` can be fetched with.
 *
 * Not used in `$fetch`'s own signatures: a method the route does not answer is already rejected by
 * {@link ValidTypedFetchPath}, and naming this in the options would instantiate it once per call
 * site for no additional check. Exported because modules building their own clients want it.
 */
export type AvailableServerRouteMethod<Request> = LegacyEngine extends true
  ? InternalApiMethods<Request>
  : Lowercase<Methods<Request> & string>

/**
 * The `body`, `query` and `headers` a request to `Request` with `Method` accepts, according to what
 * the matching route validates, falling back to ofetch's own types where it declares nothing.
 *
 * The keys are written out and only the values are computed. That is load-bearing: an interface may
 * extend a route-derived object type only where its key set is statically known, and a generic path
 * is enough to break that, which `useFetch`'s options always have. The requiredness of `body`
 * therefore lives in {@link RequiredRequestBody}, intersected at the call signature.
 *
 * A request the route set cannot resolve - a path built at runtime, or a `Request` object - falls
 * back to ofetch's own types rather than narrowing to nothing, which the accessors handle.
 */
export type TypedRequestShape<Request, Method extends AnyServerRouteMethod> = LegacyEngine extends true ? InternalApiRequestShape : {
  body?: Declared<RequestBody<Request, Uppercase<Method>, never>, FetchOptions['body']>
  query?: Declared<RequestQuery<Request, Uppercase<Method>, never>, FetchOptions['query']>
  headers?: DeclaredHeaders<RequestHeaders<Request, Uppercase<Method>, never>>
}

/**
 * The shape a route declares for a field, or `Fallback` where it declares none.
 *
 * The accessors are asked with `never` as their fallback so that "declared" and "not declared" stay
 * distinguishable: a real fallback is indistinguishable from a declared shape, since a declared
 * shape is assignable to it. This also catches a field the builder's extractor answered `never` for
 * - which is every route whose handler validates nothing, since the generator emits an extractor
 * call per field rather than deciding at build time whether one applies.
 *
 * @internal
 */
type Declared<Shape, Fallback> = [Shape] extends [never] ? Fallback : Shape

/**
 * As {@link Declared}, but a declared shape widens rather than replacing what ofetch accepts: a
 * route is validated for the headers it names, and does not reject a request for carrying more.
 *
 * @internal
 */
type DeclaredHeaders<Shape> =
  [Shape] extends [never]
    ? FetchOptions['headers']
    : (Shape & Record<string, string>) | LooseTypedHeaders<Shape> | Array<[string, string]>

/** Requires `body` where the route declares one that is not optional, and contributes nothing otherwise. */
export type RequiredRequestBody<Request, Method extends AnyServerRouteMethod> =
  LegacyEngine extends true
    ? unknown
    : RequiresBody<Request, Method> extends true
      ? { body: TypedRequestShape<Request, Method>['body'] }
      : unknown

/**
 * Whether the route declares a body a request to it cannot omit, asking the generated answer first.
 *
 * A route that declares nothing declares `never`, which is not a body anyone can supply, so it does
 * not count as required however the accessor answers.
 *
 * @internal
 */
type RequiresBody<Request, Method extends AnyServerRouteMethod> =
  [RequestBody<Request, Uppercase<Method>, never>] extends [never]
    ? false
    : Requires<Request, Uppercase<Method>, 'body'>

/**
 * Requires `body` for a request to `Request` with `Method`, without saying what it holds.
 *
 * `useFetch`'s options are an interface so that modules can extend them, which means its members
 * have to be statically known and cannot be made conditionally required. Intersecting this at the
 * call signatures instead requires the member where the route declares one, while leaving its type
 * to the interface - which also wraps it in the ref and getter forms `useFetch` accepts.
 */
export type RequiredFetchBody<Request, Method extends AnyServerRouteMethod> =
  LegacyEngine extends true
    ? unknown
    : RequiresBody<Request, Method> extends true ? { body: unknown } : unknown

/**
 * Empty where the request resolves, and a trailing argument no call supplies where it does not.
 *
 * The path union carries no method, so a signature constrained by it alone accepts a path the
 * server knows for a method that path does not answer. Requiring an argument that cannot be passed
 * takes such a signature out of the running, and the call falls through to the one that validates
 * the path, which names the path and method that matched nothing.
 *
 * The check has to sit here rather than on the parameters that carry it. Intersected onto the
 * request it is no longer a contextual type a template literal narrows against, so
 * `` `/api/posts/${id}` `` would arrive as `string` and resolve to nothing; folded into the options
 * it is unreachable, because they are optional at the signatures a call with no options resolves
 * by, and wrapping them in a conditional stops `pick` and `transform` inferring.
 */
export type UnmatchedRouteArgs<Request, Method extends AnyServerRouteMethod> =
  unknown extends ValidTypedFetchPath<Request, Method>
    ? []
    : [unmatched: ValidTypedFetchPath<Request, Method>]

/**
 * The method as written, or `never` where the matching route does not answer it.
 *
 * Narrowing is conditional on the request resolving at all: with `strictRouteTypes` off, at a path
 * known only at runtime, or against an absolute URL, the route set says nothing about which methods
 * a path answers, so any method is accepted.
 */
export type AcceptedMethod<Request, Method extends AnyServerRouteMethod> =
  LegacyEngine extends true
    ? Extract<Method, InternalApiMethods<Request> | Uppercase<InternalApiMethods<Request>>>
    : unknown extends ValidTypedFetchPath<Request, Method> ? Method : never

/**
 * The path a request is matched against, with a `baseURL` applied.
 *
 * A `baseURL` is prepended to the path before the request is made, so it is part of the route being
 * requested and has to be part of what the route set is asked about: without it, `'/hello'` with a
 * base of `'/api'` names no route, and `'/api/hello'` with the same base type-checks while
 * requesting `/api/api/hello`.
 *
 * Where the base is not statically known - a runtime value, a `ref` or a getter - the path resolves
 * to `string`, which the accessors treat as a request they cannot see, so nothing is rejected on the
 * strength of a base Nuxt cannot read.
 */
export type ResolvedFetchPath<Request, BaseURL extends string> =
  LegacyEngine extends true ? Request
    : BaseURL extends '' ? Request
      : string extends BaseURL ? string
        : Request extends `${string}://${string}` ? Request
          : BaseURL extends `${infer Base}/` ? `${Base}${Request & string}` : `${BaseURL}${Request & string}`

/**
 * The `baseURL` a call is made with: the one it passes, or the one its `$fetch` instance was created
 * with, matching how ofetch merges the two.
 */
export type EffectiveBaseURL<Instance extends string, Call extends string> = Call extends '' ? Instance : Call

/** Options accepted by Nuxt's typed `$fetch`, narrowed to what the matching route validates. */
export type TypedFetchOptions<Request, Method extends AnyServerRouteMethod = 'get', BaseURL extends string = string> =
  & Omit<FetchOptions, 'method' | 'body' | 'query' | 'params' | 'headers' | 'baseURL'>
  & { baseURL?: BaseURL }
  & { method?: AcceptedMethod<Request, Method> }
  & TypedRequestShape<Request, Method>
  & RequiredRequestBody<Request, Method>

/**
 * A request accepted by a client built for the route set `Schema` describes: one of its paths, a
 * path known only at runtime, or any non-string request `fetch` accepts.
 *
 * The paths are read out of the route set so an editor completes them. `string & {}` keeps a literal
 * from widening while still admitting a path built at runtime, which resolves to `unknown` as it
 * does against the app's own routes.
 */
export type DeclaredFetchRequest<Schema> = TypedFetchPath<Schema> | (string & {}) | Exclude<FetchRequest, string>

/**
 * The types below mirror those above for a route set a client declares rather than the one the app's
 * own server serves. They are a separate family rather than a `Schema` parameter on each of the
 * types above, because a parameter means every program would always instantiate the generic accessors.
 */

/** As {@link ValidTypedFetchPath}, resolved against a declared route set. */
export type ValidDeclaredFetchPath<Schema, Request, Method extends AnyServerRouteMethod> =
  StrictFetchPaths extends false
    ? unknown
    : string extends Request
      ? unknown
      : Request extends string
        ? Request extends `${string}://${string}`
          ? unknown
          : ValidFetchInput<Schema, Request, Uppercase<Method>>
        : unknown

/** As {@link UnmatchedRouteArgs}, resolved against a declared route set. */
export type UnmatchedDeclaredRouteArgs<Schema, Request, Method extends AnyServerRouteMethod> =
  unknown extends ValidDeclaredFetchPath<Schema, Request, Method>
    ? []
    : [unmatched: ValidDeclaredFetchPath<Schema, Request, Method>]

/** As {@link TypedServerResponse}, resolved against a declared route set. */
export type DeclaredServerResponse<Schema, Request, Default = unknown, Method extends AnyServerRouteMethod = 'get'> =
  Default extends string | boolean | number | null | void | object
    ? Default
    : TypedFetchResponseBody<Schema, Request, Uppercase<Method>> extends infer Resolved
      ? [Resolved] extends [never] ? Default : Resolved
      : Default

/** As {@link TypedServerError}, resolved against a declared route set. */
export type DeclaredServerError<Schema, Request, Method extends AnyServerRouteMethod = 'get'> =
  TypedFetchErrorBody<Schema, Request, Uppercase<Method>>

/** As {@link TypedRequestShape}, resolved against a declared route set. */
export type DeclaredRequestShape<Schema, Request, Method extends AnyServerRouteMethod> = {
  body?: Declared<TypedFetchRequestBody<Schema, Request, Uppercase<Method>, never>, FetchOptions['body']>
  query?: Declared<TypedFetchRequestQuery<Schema, Request, Uppercase<Method>, never>, FetchOptions['query']>
  headers?: DeclaredHeaders<TypedFetchRequestHeaders<Schema, Request, Uppercase<Method>, never>>
}

/** @internal */
type RequiresDeclaredBody<Schema, Request, Method extends AnyServerRouteMethod> =
  [TypedFetchRequestBody<Schema, Request, Uppercase<Method>, never>] extends [never]
    ? false
    : TypedFetchRequires<Schema, Request, Uppercase<Method>, 'body'>

/** As {@link RequiredFetchBody}, resolved against a declared route set. */
export type RequiredDeclaredBody<Schema, Request, Method extends AnyServerRouteMethod> =
  RequiresDeclaredBody<Schema, Request, Method> extends true ? { body: unknown } : unknown

/** As {@link AcceptedMethod}, resolved against a declared route set. */
export type AcceptedDeclaredMethod<Schema, Request, Method extends AnyServerRouteMethod> =
  unknown extends ValidDeclaredFetchPath<Schema, Request, Method> ? Method : never

/**
 * A `fetch` implementation whose responses are typed from the routes the server serves.
 *
 * Two signatures. The first is constrained by the path union, so an editor offers the registered
 * paths as completions, and is what a resolving call is answered by; it carries
 * {@link UnmatchedRouteArgs}, because that union carries no method and would otherwise accept a
 * path the server knows for a method that path does not answer. The second validates the path and
 * is what names one that matched nothing.
 *
 * The second is constrained by `string` rather than by {@link TypedFetchPathInput}, so that naming
 * the response type (`$fetch<Something>(url)`) still compiles: doing so turns off inference for the
 * request, and a pattern constraint has no default a runtime path would satisfy. The consequence is
 * that `$fetch` validates a path it can see and passes one it cannot; `useFetch` keeps the pattern,
 * which it needs so a literal survives `ref` and `computed`.
 *
 * Concrete, never generic over the route set: `$fetch` is declared as a value in generated types
 * and returned from `useRequestFetch()`, both of which need a type with no schema parameter.
 */
export interface TypedFetch<DefaultT = unknown, DefaultB extends string = ''> {
  <T = DefaultT, R extends TypedFetchRequest = TypedFetchRequest, M extends AnyServerRouteMethod = unknown extends T ? 'get' : AnyServerRouteMethod, const B extends string = '', _R = ResolvedFetchPath<R, EffectiveBaseURL<DefaultB, B>>>(
    request: R,
    opts?: TypedFetchOptions<_R, M, B>,
    ...unmatched: UnmatchedRouteArgs<_R, M>
  ): Promise<TypedServerResponse<_R, T, M>>
  <T = DefaultT, R extends AnyFetchPath = AnyFetchPath, M extends AnyServerRouteMethod = unknown extends T ? 'get' : AnyServerRouteMethod, const B extends string = '', _R = ResolvedFetchPath<R, EffectiveBaseURL<DefaultB, B>>>(
    request: R & ValidTypedFetchPath<_R, M>,
    opts?: TypedFetchOptions<_R, M, B>,
  ): Promise<TypedServerResponse<_R, T, M>>

  raw: {
    <T = DefaultT, R extends TypedFetchRequest = TypedFetchRequest, M extends AnyServerRouteMethod = unknown extends T ? 'get' : AnyServerRouteMethod, const B extends string = '', _R = ResolvedFetchPath<R, EffectiveBaseURL<DefaultB, B>>>(
      request: R,
      opts?: TypedFetchOptions<_R, M, B>,
      ...unmatched: UnmatchedRouteArgs<_R, M>
    ): Promise<FetchResponse<TypedServerResponse<_R, T, M>>>
    <T = DefaultT, R extends AnyFetchPath = AnyFetchPath, M extends AnyServerRouteMethod = unknown extends T ? 'get' : AnyServerRouteMethod, const B extends string = '', _R = ResolvedFetchPath<R, EffectiveBaseURL<DefaultB, B>>>(
      request: R & ValidTypedFetchPath<_R, M>,
      opts?: TypedFetchOptions<_R, M, B>,
    ): Promise<FetchResponse<TypedServerResponse<_R, T, M>>>
  }

  create: <T = DefaultT, const B extends string = DefaultB>(defaults: Omit<FetchOptions, 'baseURL'> & { baseURL?: B }) => TypedFetch<T, EffectiveBaseURL<DefaultB, B>>
}

export type { AnyHTTPMethod }
