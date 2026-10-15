import type { $Fetch } from 'nitropack/types'
import { expectTypeOf } from 'vitest'

type Identical<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

export async function globalFetch () {
  expectTypeOf<Identical<typeof $fetch, $Fetch>>().toEqualTypeOf<true>()

  const hello = await $fetch('/api/hello')
  expectTypeOf(hello).toEqualTypeOf<{ hello: boolean }>()
}
