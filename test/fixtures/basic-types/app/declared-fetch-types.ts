import { expectTypeOf } from 'vitest'
import type { DynamicParam, Endpoint } from 'nuxt/app'
import { createUseFetch } from '#imports'

interface Pet { id: number, name: string }

interface PetStoreRoutes {
  '/pets': {
    [Endpoint]: {
      GET: { response: Pet[], query: { limit?: number } }
      POST: { response: Pet, body: { name: string } }
    }
    [DynamicParam]: {
      [Endpoint]: { GET: { response: Pet } }
    }
  }
}

const usePetStore = createUseFetch({
  baseURL: 'https://api.example.com',
  routes: {} as PetStoreRoutes,
})

expectTypeOf(usePetStore('/pets', { query: { limit: 10 } }).data.value).toEqualTypeOf<Pet[] | undefined>()
expectTypeOf(usePetStore('/pets/42').data.value).toEqualTypeOf<Pet | undefined>()
usePetStore('/pets', { method: 'post', body: { name: 'Rex' } })
// @ts-expect-error POST requires a body
usePetStore('/pets', { method: 'post' })
// @ts-expect-error name must be a string
usePetStore('/pets', { method: 'post', body: { name: 42 } })
// @ts-expect-error limit must be a number
usePetStore('/pets', { query: { limit: '10' } })
expectTypeOf(usePetStore('/pats').data.value).toBeUnknown()
expectTypeOf(usePetStore('/pets', { method: 'put' }).data.value).toBeUnknown()
