import type { EventHandlerRequest, H3Event } from 'nitro/h3'

/**
 * The request shapes a handler validates, extracted from the handler's own type so that Nuxt can
 * require them at the call site without the shapes being declared twice.
 */

/** The request description a handler receives, or `never` for anything that is not a handler. */
type RequestOf<Handler> = Handler extends (event: H3Event<infer Request>) => any ? Request : never

/** Whether two types are identical, used to tell a validated shape from h3's default. */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

/**
 * Narrows an extracted shape to something a request can carry. Handlers that validate nothing
 * contribute `never`, which leaves the call site as permissive as it was.
 */
type Shape<T> = [T] extends [never]
  ? never
  : unknown extends T
    ? never
    : T extends Iterable<any>
      ? never
      : T extends Record<string, any>
        ? T
        : never

/**
 * A validated body is reachable two ways depending on the h3 version: through `json()` where the
 * handler's request type is `Request`-like, and directly on `body` once it describes what was
 * validated. `json()` is tried first because in the former case `body` is the unparsed stream.
 */
type BodyOf<Request> = Request extends { json: () => Promise<infer Body> }
  ? Shape<Body>
  : Request extends { body?: infer Body }
    ? Equals<Body, EventHandlerRequest['body']> extends true
      ? never
      : Shape<NonNullable<Body>>
    : never

/** The body a handler validates, or `never` when it validates none. */
export type RequestBodyOf<Handler> = BodyOf<RequestOf<Handler>>

/** The query a handler validates, or `never` when it validates none. */
export type RequestQueryOf<Handler> = 'query' extends keyof RequestOf<Handler>
  ? Equals<RequestOf<Handler>['query'], EventHandlerRequest['query']> extends true
    ? never
    : Shape<NonNullable<RequestOf<Handler>['query']>>
  : never

/** The headers a handler validates, or `never` when it validates none. */
export type RequestHeadersOf<Handler> = 'headers' extends keyof RequestOf<Handler>
  ? Shape<NonNullable<RequestOf<Handler>['headers']>>
  : never
