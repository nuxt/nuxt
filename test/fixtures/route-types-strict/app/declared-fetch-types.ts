import { expectTypeOf } from 'vitest'
import type { Endpoint } from 'nuxt/app'
import { createUseFetch } from '#imports'

interface PetStoreRoutes {
  '/pets': {
    [Endpoint]: { GET: { response: { id: number }[] } }
  }
}

const usePetStore = createUseFetch({ routes: {} as PetStoreRoutes })
expectTypeOf(usePetStore('/pets').data.value).toEqualTypeOf<{ id: number }[] | undefined>()
// @ts-expect-error no route matches /pats
usePetStore('/pats')
// @ts-expect-error /pets has no PUT method
usePetStore('/pets', { method: 'put' })
