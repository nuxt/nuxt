import { expectTypeOf } from 'vitest'

// the global `$fetch` (no import) resolves through the same route types as `#build/fetch`
export async function globalFetch () {
  expectTypeOf(await $fetch('/api/hello')).toEqualTypeOf<{ hello: boolean }>()

  // @ts-expect-error no GET route matches '/api/helo'
  await $fetch('/api/helo')

  // @ts-expect-error `count` is not a string
  await $fetch('/api/validated', { method: 'POST', body: { title: 'a', count: 'no' }, query: { page: '1' } })
}
