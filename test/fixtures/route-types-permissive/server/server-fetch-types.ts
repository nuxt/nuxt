import { expectTypeOf } from 'vitest'
import type { RequestEvent, ServerFetchResponse } from 'nuxt/server'
import { serverFetch } from 'nuxt/server'

declare const event: RequestEvent

export async function permissiveServerFetch () {
  const hello = await serverFetch(event, '/api/hello')
  expectTypeOf(hello).toEqualTypeOf<ServerFetchResponse<{ hello: boolean }>>()
  expectTypeOf(await hello.json()).toEqualTypeOf<{ hello: boolean }>()

  expectTypeOf(await serverFetch(event, '/api/not-a-route')).toEqualTypeOf<Response>()
  expectTypeOf(await serverFetch(event, '/api/hello', { method: 'delete' })).toEqualTypeOf<Response>()
}
