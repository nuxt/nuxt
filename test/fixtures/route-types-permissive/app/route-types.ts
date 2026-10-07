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
