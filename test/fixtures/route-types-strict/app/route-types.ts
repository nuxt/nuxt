import { expectTypeOf } from 'vitest'
import { $fetch } from '#build/fetch'

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

export function strictComposable () {
  expectTypeOf(useFetch('/api/hello').data.value).toEqualTypeOf<{ hello: boolean } | undefined>()

  // @ts-expect-error no GET route matches '/api/helo'
  useFetch('/api/helo')

  // @ts-expect-error the route validates a body, so it cannot be omitted
  useFetch('/api/validated', { method: 'POST', query: { page: '1' } })
}
