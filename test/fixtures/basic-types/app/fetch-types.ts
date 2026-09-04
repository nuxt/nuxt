import { expectTypeOf } from 'vitest'

export async function probe () {
  // a route the fixture serves
  const hello = await $fetch('/api/hello')
  expectTypeOf(hello).toEqualTypeOf<string>()

  // the nested-parameter route this build fixes
  const nested = await $fetch('/api/users/1/posts/2')
  expectTypeOf(nested).toEqualTypeOf<{ userId: string, postId: string }>()

  // a typo must be rejected
  // @ts-expect-error no GET route matches '/api/helo'
  await $fetch('/api/helo')

  // query strings and trailing slashes are tolerated
  const query = await $fetch('/api/hello?a=1')
  expectTypeOf(query).toEqualTypeOf<string>()

  // a method the route does not answer. `/api/hello` is registered without one, so it answers
  // every method; `/api/hey` is `index.get.ts` and answers only GET
  await $fetch('/api/hello', { method: 'put' })
  // @ts-expect-error no PUT route matches '/api/hey'
  await $fetch('/api/hey', { method: 'put' })

  // the default method is GET, so a route that answers only POST is not fetchable without one
  // @ts-expect-error no GET route matches '/api/validated'
  await $fetch('/api/validated')
  // @ts-expect-error no GET route matches '/api/validated'
  await $fetch.raw('/api/validated')
  // @ts-expect-error no GET route matches '/api/validated'
  useFetch('/api/validated')

  // uppercase methods infer
  const validated = await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 1 } })
  // @ts-expect-error `count` is not a string
  await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 'no' } })
  // @ts-expect-error the route validates a body, so it cannot be omitted
  await $fetch('/api/validated', { method: 'POST' })
  expectTypeOf<typeof validated>().not.toBeUnknown()

  // an absolute URL is not Nuxt's to describe, so any method is accepted
  await $fetch('https://example.com/x', { method: 'post' })

  // an explicit response type still overrides
  const overridden = await $fetch<{ mine: true }>('/api/hello')
  expectTypeOf(overridden).toEqualTypeOf<{ mine: true }>()

  // a runtime path is passed through
  const runtime: string = '/api/hello'
  const opaque = await $fetch(runtime, { query: { a: 1 } })
  expectTypeOf(opaque).toEqualTypeOf<unknown>()

  // useFetch resolves and rejects the same way
  const { data } = useFetch('/api/hello')
  expectTypeOf(data.value).toEqualTypeOf<string | undefined>()
  // @ts-expect-error no GET route matches '/api/helo'
  useFetch('/api/helo')
}

declare const runtimeBase: string

/** A `baseURL` is prepended before the request is made, so it is part of the route resolved. */
export async function baseURLProbe () {
  expectTypeOf(await $fetch('/hello', { baseURL: '/api' })).toEqualTypeOf<string>()
  expectTypeOf(await $fetch('/hello', { baseURL: '/api/' })).toEqualTypeOf<string>()
  expectTypeOf(await $fetch('/users/1/posts/2', { baseURL: '/api' })).toEqualTypeOf<{ userId: string, postId: string }>()
  expectTypeOf(useFetch('/hello', { baseURL: '/api' }).data.value).toEqualTypeOf<string | undefined>()

  // the path as written is not resolved on its own, so the double prefix is an error
  // @ts-expect-error no GET route matches '/api/api/hello'
  await $fetch('/api/hello', { baseURL: '/api' })
  // and so is a method the resolved route does not answer
  // @ts-expect-error no PUT route matches '/api/hey'
  await $fetch('/hey', { baseURL: '/api', method: 'put' })

  // a base Nuxt cannot read says nothing about the route, so nothing is rejected
  expectTypeOf(await $fetch('/hello', { baseURL: runtimeBase })).toEqualTypeOf<unknown>()
  expectTypeOf(await $fetch('/users', { baseURL: 'https://api.example.com' })).toEqualTypeOf<unknown>()

  // an instance carries its own base, and a base passed at the call site wins
  const api = $fetch.create({ baseURL: '/api' })
  expectTypeOf(await api('/hello')).toEqualTypeOf<string>()
  expectTypeOf(await api('/1/posts/2', { baseURL: '/api/users' })).toEqualTypeOf<{ userId: string, postId: string }>()
  // @ts-expect-error no GET route matches '/api/api/hello'
  await api('/api/hello')

  const useApiFetch = createUseFetch({ baseURL: '/api' })
  expectTypeOf(useApiFetch('/hello').data.value).toEqualTypeOf<string | undefined>()
  expectTypeOf(useApiFetch('/hello', { transform: v => v.length }).data.value).toEqualTypeOf<number | undefined>()
  // @ts-expect-error no GET route matches '/api/helo'
  useApiFetch('/helo')
}
