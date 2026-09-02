import { expectTypeOf } from 'vitest'
import { $fetch } from '#build/fetch'

/**
 * With `experimental.routeTypedFetch` off, requests are typed from the responses nitro contributes
 * to `ServerRoutes`, whatever the compatibility version.
 */
declare module '@nuxt/schema' {
  interface ServerRoutes {
    '/api/augmented': { get: { augmented: true }, post: { created: true } }
  }
}

export async function internalApiRoutes () {
  // a scanned handler is typed from nitro's own declarations
  expectTypeOf(await $fetch('/api/hello')).toEqualTypeOf<{ hello: boolean }>()
  expectTypeOf((await $fetch('/api/when')).at).toEqualTypeOf<string>()

  // a route registered by augmenting `ServerRoutes` by hand is picked up
  expectTypeOf(await $fetch('/api/augmented')).toEqualTypeOf<{ augmented: true }>()
  expectTypeOf(await $fetch('/api/augmented', { method: 'post' })).toEqualTypeOf<{ created: true }>()

  // @ts-expect-error the augmented route is not registered for `put`
  await $fetch('/api/augmented', { method: 'put' })

  // a path no route describes is accepted and resolves to `unknown`
  expectTypeOf(await $fetch('/api/not-a-route')).toEqualTypeOf<unknown>()

  // `params` is still accepted, as an alias for `query`
  expectTypeOf(await $fetch('/api/hello', { params: { a: 1 } })).toEqualTypeOf<{ hello: boolean }>()

  // and a `baseURL` is not part of the path a route is matched against
  expectTypeOf(await $fetch('/hello', { baseURL: '/api' })).toEqualTypeOf<unknown>()
}

export function internalApiComposable () {
  expectTypeOf(useFetch('/api/augmented').data.value).toEqualTypeOf<{ augmented: true } | undefined>()
  expectTypeOf(useFetch('/api/hello', { params: { a: 1 } }).data.value).toEqualTypeOf<{ hello: boolean } | undefined>()
  expectTypeOf(useFetch('/api/not-a-route').data.value).toEqualTypeOf<unknown>()
}
