/**
 * The generator emits an extractor call per request field for every single-handler route, so a
 * handler that validates nothing declares the field with the value `never` rather than omitting it.
 * Asking an accessor with a real fallback therefore returns `never`, not the fallback; asking it
 * with `never` is what makes "declared" and "not declared" distinguishable.
 */
import type { ServerRoutes } from '@nuxt/schema'
import type { TypedFetchRequestQuery } from 'nuxt/app'
import type { RequestBody, RequestQuery } from '#build/server-routes'

type Eq<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T

// `/api/hello` validates nothing, so its metadata declares `query: never`
export type Undeclared = Assert<Eq<RequestQuery<'/api/hello', 'GET', never>, never>>
// which means a real fallback is *not* reached - the field is present, holding `never`
export type FallbackNotReached = Assert<Eq<RequestQuery<'/api/hello', 'GET', { fb: true }>, never>>
export type SameOverAugmented = Assert<Eq<TypedFetchRequestQuery<ServerRoutes, '/api/hello', 'GET', { fb: true }>, never>>
// `/api/validated` validates a body, and that declaration survives being asked with `never`
export type DeclaredSurvives = Assert<Eq<RequestBody<'/api/validated', 'POST', never>, { title: string, count: number }>>
