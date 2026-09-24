import { expectTypeOf } from 'vitest'
import type { Endpoint } from 'nuxt/app'
import { $fetch } from '#build/fetch'

declare module '@nuxt/schema' {
  interface ServerRoutes {
    '/api/fetchdts-shape': {
      [Endpoint]: {
        GET: { response: { fetchdts: true } }
        POST: { response: { fetchdtsCreated: true } }
      }
    }
    '/api/legacy-shape': { get: { legacy: true } }
  }
}

export async function serverRoutesShapes () {
  expectTypeOf(await $fetch('/api/fetchdts-shape')).toEqualTypeOf<{ fetchdts: true }>()
  expectTypeOf(await $fetch('/api/fetchdts-shape', { method: 'post' })).toEqualTypeOf<{ fetchdtsCreated: true }>()
  expectTypeOf(await $fetch('/api/legacy-shape')).toEqualTypeOf<{ legacy: true }>()
}
