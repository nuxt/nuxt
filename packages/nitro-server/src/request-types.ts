import type { EventHandlerRequest, H3Event } from 'h3'

/**
 * The request shapes a handler validates, extracted from the handler's own type so that Nuxt can
 * require them at the call site without the shapes being declared twice.
 *
 * h3 v1 describes a validated request with `body` and `query` only, so no headers are contributed
 * and a request's headers stay as permissive as ofetch declares them.
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

/** The body a handler validates, or `never` when it validates none. */
export type RequestBodyOf<Handler> = 'body' extends keyof RequestOf<Handler>
  ? Equals<RequestOf<Handler>['body'], EventHandlerRequest['body']> extends true
    ? never
    : Shape<NonNullable<RequestOf<Handler>['body']>>
  : never

/** The query a handler validates, or `never` when it validates none. */
export type RequestQueryOf<Handler> = 'query' extends keyof RequestOf<Handler>
  ? Equals<RequestOf<Handler>['query'], EventHandlerRequest['query']> extends true
    ? never
    : Shape<NonNullable<RequestOf<Handler>['query']>>
  : never
