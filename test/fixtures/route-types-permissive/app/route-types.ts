import type { FetchOptions } from '#app'
import { expectTypeOf } from 'vitest'

/**
 * `experimental.strictRouteTypes` is unset, so this asserts the default: a request Nuxt does not
 * recognise is accepted and resolves to `unknown`, because a nitro middleware, a `routeRules` proxy
 * or a catch-all handler can answer a path no route describes.
 */
export async function permissive () {
  // a registered route is still typed
  expectTypeOf(await $fetch('/api/hello')).toEqualTypeOf<{ hello: boolean }>()

  // and anything else is accepted rather than rejected
  expectTypeOf(await $fetch('/api/not-a-route')).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch('/proxied/elsewhere')).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch('/about')).toEqualTypeOf<unknown>()

  // including a path built at runtime
  const dynamic: string = '/api/hello'
  expectTypeOf(await $fetch(dynamic)).toEqualTypeOf<unknown>()

  // a method a registered route does not answer is accepted too: with the route set incomplete,
  // nothing can be said about which methods a path answers
  expectTypeOf(await $fetch('/api/hello', { method: 'delete' })).toEqualTypeOf<unknown>()
}

/** With the route set incomplete, a `baseURL` cannot make a request any more or less resolvable. */
export async function permissiveBaseURL () {
  expectTypeOf(await $fetch('/hello', { baseURL: '/api' })).toEqualTypeOf<{ hello: boolean }>()
  expectTypeOf(await $fetch('/not-a-route', { baseURL: '/api' })).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch('/users', { baseURL: 'https://api.example.com' })).toEqualTypeOf<unknown>()
}

export function permissiveComposable () {
  const { data } = useFetch('/api/hello')
  expectTypeOf(data.value).toEqualTypeOf<{ hello: boolean } | undefined>()

  const { data: unknownData } = useFetch('/api/not-a-route')
  expectTypeOf(unknownData.value).toEqualTypeOf<unknown>()
}

interface SearchResponse { data?: { organization?: { team?: { members: { nodes: Array<{ login: string }> } } } } }

/** A call that names its response type, or a wrapper that does, accepts any method. */
export async function permissiveNamedResponseMethod<T> (url: string, body: Record<string, unknown>) {
  await $fetch<T>(url, { method: 'POST', body })
  await $fetch.raw<T>(url, { method: 'POST', body })
  expectTypeOf(await $fetch<unknown>('https://example.com', { method: 'PUT' })).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch<SearchResponse>('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: 'x' }, body: { query: 'q' } })).toEqualTypeOf<SearchResponse>()
}

/** A URL the app does not serve is fetched with options typed for any request. */
export async function permissiveExternalFetch<T> (url: string, options: FetchOptions = {}) {
  const post: FetchOptions = { method: 'POST', body: { a: 1 }, query: { a: 1 }, headers: { a: 'b' } }
  await $fetch(new Request('https://example.com'))
  await $fetch.raw(new Request('https://example.com'))
  await $fetch<T>(url, post)
  return await $fetch<T>(url, options)
}

const api = $fetch.create({ headers: { 'x-client': 'app' } })

/** An instance created from `$fetch` is typed by the routes it is called with. */
export async function permissiveCreatedFetch () {
  expectTypeOf(await api('/api/hello')).toEqualTypeOf<{ hello: boolean }>()
  expectTypeOf(await api('/proxied', { method: 'POST', body: { target: 'x' } })).toEqualTypeOf<{ proxied: boolean }>()
  // @ts-expect-error the route validates a body, so it cannot be omitted
  await api('/proxied', { method: 'POST' })
  // @ts-expect-error `target` is not a number
  await api('/proxied', { method: 'POST', body: { target: 1 } })
}
