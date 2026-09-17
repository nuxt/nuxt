/**
 * Stub for `#build/server-routes`, used only via `paths` in `tsconfig.build.json` while emitting
 * this package's declarations. Matches the accessors `compileRoutes` emits, over an empty route
 * set, so the app layer compiles before any project has generated its routes.
 */
import type { AnyHTTPMethod, TypedFetchErrorBody, TypedFetchMethods, TypedFetchRequestBody, TypedFetchRequestHeaders, TypedFetchRequestQuery, TypedFetchRequires, TypedFetchResponseBody, TypedFetchResponseHeaders, ValidFetchInput } from 'fetchdts'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GeneratedServerRoutes {}

export type Path = never

export type StrictFetchPaths = false

export type ValidInput<Path_, Method extends AnyHTTPMethod = 'GET'> = ValidFetchInput<GeneratedServerRoutes, Path_, Method>
export type Response<Path_, Method extends AnyHTTPMethod = 'GET'> = TypedFetchResponseBody<GeneratedServerRoutes, Path_, Method>
export type ResponseHeaders<Path_, Method extends AnyHTTPMethod = 'GET'> = TypedFetchResponseHeaders<GeneratedServerRoutes, Path_, Method>
export type ErrorBody<Path_, Method extends AnyHTTPMethod = 'GET'> = TypedFetchErrorBody<GeneratedServerRoutes, Path_, Method>
export type RequestBody<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = BodyInit | null> = TypedFetchRequestBody<GeneratedServerRoutes, Path_, Method, Fallback>
export type RequestQuery<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = Record<string, unknown>> = TypedFetchRequestQuery<GeneratedServerRoutes, Path_, Method, Fallback>
export type RequestHeaders<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = HeadersInit> = TypedFetchRequestHeaders<GeneratedServerRoutes, Path_, Method, Fallback>
export type Methods<Path_> = TypedFetchMethods<GeneratedServerRoutes, Path_>
export type Requires<Path_, Method extends AnyHTTPMethod, Field extends 'body' | 'query' | 'headers'> = TypedFetchRequires<GeneratedServerRoutes, Path_, Method, Field>
