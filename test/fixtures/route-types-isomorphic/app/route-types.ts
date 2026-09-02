import { expectTypeOf } from 'vitest'

/**
 * `experimental.strictRouteTypes: 'isomorphic'` puts the routes the Vue router serves into the
 * schema alongside the server handlers, so a page's path is typed as the document it renders rather
 * than rejected for having no handler.
 */
export async function isomorphic () {
  // a server route is typed by its handler
  expectTypeOf(await $fetch('/api/hello')).toEqualTypeOf<{ hello: boolean }>()

  // a page answers GET with the rendered document
  expectTypeOf(await $fetch('/about')).toEqualTypeOf<string>()
  expectTypeOf(await $fetch('/')).toEqualTypeOf<string>()

  // @ts-expect-error neither a handler nor a page answers this
  await $fetch('/not-a-route')

  // @ts-expect-error a page answers GET only
  await $fetch('/about', { method: 'post' })
}

export function isomorphicComposable () {
  const { data } = useFetch('/about')
  expectTypeOf(data.value).toEqualTypeOf<string | undefined>()

  // @ts-expect-error neither a handler nor a page answers this
  useFetch('/not-a-route')
}
