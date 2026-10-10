import { expectTypeOf } from 'vitest'
import type { RequestEvent, ServerFetchResponse } from 'nuxt/server'
import { serverFetch } from 'nuxt/server'

declare const event: RequestEvent

export async function strictServerFetch () {
  const hello = await serverFetch(event, '/api/hello')
  expectTypeOf(hello).toEqualTypeOf<ServerFetchResponse<{ hello: boolean }>>()
  expectTypeOf(await hello.json()).toEqualTypeOf<{ hello: boolean }>()

  const validated = await serverFetch(event, '/api/validated', { method: 'POST', body: JSON.stringify({ title: 'a', count: 1 }) })
  expectTypeOf(await validated.json()).toEqualTypeOf<{ created: boolean }>()

  // @ts-expect-error no GET route matches '/api/helo'
  await serverFetch(event, '/api/helo')
  // @ts-expect-error no GET route matches '/api/validated'
  await serverFetch(event, '/api/validated')
}
