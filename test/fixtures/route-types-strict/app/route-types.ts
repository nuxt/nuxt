import type { FetchOptions } from '#app'
import { expectTypeOf } from 'vitest'

/**
 * `future.compatibilityVersion: 5` types requests from the routes the server builder reported, and
 * `experimental.strictRouteTypes` makes a path no route answers an error.
 */
export async function strictRoutes () {
  expectTypeOf(await $fetch('/api/hello')).toEqualTypeOf<{ hello: boolean }>()

  // @ts-expect-error no GET route matches '/api/helo'
  await $fetch('/api/helo')

  // @ts-expect-error a page is not part of the route set unless `strictRouteTypes` is 'isomorphic'
  await $fetch('/')

  // @ts-expect-error `/api/hello` answers GET only
  await $fetch('/api/hello', { method: 'post' })

  // an absolute URL is not Nuxt's to describe
  expectTypeOf(await $fetch('https://example.com/x', { method: 'post' })).toEqualTypeOf<unknown>()

  // an explicit response type overrides, and turns off inference for the request
  expectTypeOf(await $fetch<{ mine: true }>('/api/anything')).toEqualTypeOf<{ mine: true }>()
}

/** A response is typed as it arrives over the wire, not as the handler returned it. */
export async function serializedResponses () {
  expectTypeOf(await $fetch('/api/when')).toEqualTypeOf<{ at: string, tags: Record<string, never> }>()
  expectTypeOf(useFetch('/api/when').data.value).toEqualTypeOf<{ at: string, tags: Record<string, never> } | undefined>()
}

/** A request is checked against what the handler validates. */
export async function validatedRequests () {
  expectTypeOf(await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 1 }, query: { page: '1' } })).toEqualTypeOf<{ created: boolean }>()

  // @ts-expect-error `count` is not a string
  await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 'no' }, query: { page: '1' } })

  // @ts-expect-error the route validates a body, so it cannot be omitted
  await $fetch('/api/validated', { method: 'POST', query: { page: '1' } })

  // @ts-expect-error `page` is not a number
  await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 1 }, query: { page: 1 } })

  // @ts-expect-error `params` is no longer accepted
  await $fetch('/api/hello', { params: { a: 1 } })
}

declare const runtimeBase: string

/** A call that names its response type accepts any `baseURL`. */
export async function namedResponseBaseURLProbe<T extends { id: number }> () {
  expectTypeOf(await $fetch<{ id: number }>('/users', { baseURL: runtimeBase })).toEqualTypeOf<{ id: number }>()
  expectTypeOf(await $fetch<{ id: number }>('/users', { baseURL: '/api' })).toEqualTypeOf<{ id: number }>()
  expectTypeOf(useFetch<{ id: number }>('/users', { baseURL: runtimeBase }).data.value).toEqualTypeOf<{ id: number } | undefined>()
  expectTypeOf(useLazyFetch<{ id: number }>('/users', { baseURL: () => runtimeBase }).data.value).toEqualTypeOf<{ id: number } | undefined>()
  expectTypeOf(useFetch<T>('/users', { baseURL: runtimeBase }).data.value?.id).toEqualTypeOf<number | undefined>()

  const api = $fetch.create({ baseURL: '/api' })
  expectTypeOf(await api<{ id: number }>('/users', { baseURL: runtimeBase })).toEqualTypeOf<{ id: number }>()
  expectTypeOf(await $fetch.create<{ id: number }>({ baseURL: runtimeBase })('/users')).toEqualTypeOf<{ id: number }>()
  expectTypeOf(createUseFetch<{ id: number }>({ baseURL: runtimeBase })('/users').data.value).toEqualTypeOf<{ id: number } | undefined>()

  // a response type taken from context leaves the request inferred, so it is still validated
  // @ts-expect-error no GET route matches '/api/helo'
  const contextual: string = await $fetch('/api/helo')
  return contextual
}

export function strictComposable () {
  expectTypeOf(useFetch('/api/hello').data.value).toEqualTypeOf<{ hello: boolean } | undefined>()

  // @ts-expect-error no GET route matches '/api/helo'
  useFetch('/api/helo')

  // @ts-expect-error the route validates a body, so it cannot be omitted
  useFetch('/api/validated', { method: 'POST', query: { page: '1' } })
}

interface SearchResponse { data?: { organization?: { team?: { members: { nodes: Array<{ login: string }> } } } } }

/** A call that names its response type, or a wrapper that does, accepts any method. */
export async function namedResponseMethodProbe<T> (url: string, body: Record<string, unknown>) {
  await $fetch<T>(url, { method: 'POST', body })
  await $fetch.raw<T>(url, { method: 'POST', body })
  expectTypeOf(await $fetch<unknown>('https://example.com', { method: 'PUT' })).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch<SearchResponse>('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: 'x' }, body: { query: 'q' } })).toEqualTypeOf<SearchResponse>()

  // a call that infers its request is still resolved against GET
  // @ts-expect-error no GET route matches '/api/validated'
  await $fetch('/api/validated')
  expectTypeOf(await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 1 }, query: { page: '1' } })).toEqualTypeOf<{ created: boolean }>()
}

/** A URL the app does not serve is fetched with options typed for any request. */
export async function externalFetchProbe<T> (url: string, options: FetchOptions = {}) {
  const post: FetchOptions = { method: 'POST', body: { a: 1 }, query: { a: 1 }, headers: { a: 'b' } }
  await $fetch(new Request('https://example.com'))
  await $fetch.raw(new Request('https://example.com'))
  await $fetch<T>(url, post)
  return await $fetch<T>(url, options)
}

const api = $fetch.create({ headers: { 'x-client': 'app' } })

/** An instance created from `$fetch` is typed by the routes it is called with. */
export async function createdFetchProbe () {
  expectTypeOf(await api('/api/hello')).toEqualTypeOf<{ hello: boolean }>()
  expectTypeOf(await api('/api/validated', { method: 'POST', body: { title: 'a', count: 1 }, query: { page: '1' } })).toEqualTypeOf<{ created: boolean }>()
  // @ts-expect-error the route validates a body, so it cannot be omitted
  await api('/api/validated', { method: 'POST', query: { page: '1' } })
  // @ts-expect-error `count` is not a string
  await api('/api/validated', { method: 'POST', body: { title: 'a', count: '1' }, query: { page: '1' } })
  // @ts-expect-error no GET route matches '/api/helo'
  await api('/api/helo')
}
