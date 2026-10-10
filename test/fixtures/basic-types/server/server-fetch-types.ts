import { expectTypeOf } from 'vitest'
import type { RequestEvent, ServerFetchResponse } from 'nuxt/server'
import { serverFetch } from 'nuxt/server'

declare const event: RequestEvent

export async function serverFetchProbe () {
  const hey = await serverFetch(event, '/api/hey')
  expectTypeOf(hey).toEqualTypeOf<ServerFetchResponse<{ foo: string, baz: string }>>()
  expectTypeOf(await hey.json()).toEqualTypeOf<{ foo: string, baz: string }>()
  expectTypeOf(await hey.clone().json()).toEqualTypeOf<{ foo: string, baz: string }>()
  expectTypeOf(hey).toExtend<Response>()

  expectTypeOf(await (await serverFetch(event, '/api/posts/1')).json()).toEqualTypeOf<number>()
  expectTypeOf(await (await serverFetch(event, '/api/hey?a=1')).json()).toEqualTypeOf<{ foo: string, baz: string }>()

  expectTypeOf(await (await serverFetch(event, '/api/hey', { method: 'post' })).json()).toEqualTypeOf<{ method: 'post' }>()
  expectTypeOf(await (await serverFetch(event, '/api/hey', { method: 'POST' })).json()).toEqualTypeOf<{ method: 'post' }>()

  expectTypeOf(await serverFetch(event, '/api/hello')).toEqualTypeOf<Response>()
  expectTypeOf(await serverFetch(event, '/api/posts/static')).toEqualTypeOf<Response>()

  // @ts-expect-error no PUT route matches '/api/hey'
  await serverFetch(event, '/api/hey', { method: 'put' })

  const path = '/api/hey' as string
  expectTypeOf(await serverFetch(event, path)).toEqualTypeOf<Response>()
  const method = 'get' as string
  expectTypeOf(await serverFetch(event, '/api/hey', { method })).toEqualTypeOf<Response>()

  await serverFetch(event, '/api/hey', { forwardHeaders: ['x-custom'], headers: { accept: 'application/json' } })
}
