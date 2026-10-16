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

  const nested = await serverFetch(event, '/api/users/1/posts/2')
  expectTypeOf(await nested.json()).toEqualTypeOf<{ userId: string, postId: string }>()

  const id = '1' as string
  const templated = await serverFetch(event, `/api/users/${id}/posts/2`)
  expectTypeOf(await templated.json()).toEqualTypeOf<{ userId: string, postId: string }>()

  expectTypeOf(await (await serverFetch(event, '/api/posts/1')).json()).toEqualTypeOf<number>()
  expectTypeOf(await (await serverFetch(event, '/api/hey?a=1')).json()).toEqualTypeOf<{ foo: string, baz: string }>()

  expectTypeOf(await (await serverFetch(event, '/api/hey', { method: 'post' })).json()).toEqualTypeOf<{ method: 'post' }>()
  expectTypeOf(await (await serverFetch(event, '/api/hey', { method: 'POST' })).json()).toEqualTypeOf<{ method: 'post' }>()
  const validated = await serverFetch(event, '/api/validated', { method: 'POST', body: JSON.stringify({ title: 'a', count: 1 }) })
  expectTypeOf(await validated.json()).toEqualTypeOf<{ created: boolean }>()

  expectTypeOf(await serverFetch(event, '/api/hello')).toEqualTypeOf<Response>()
  expectTypeOf(await serverFetch(event, '/api/posts/static')).toEqualTypeOf<Response>()

  // @ts-expect-error no GET route matches '/api/helo'
  await serverFetch(event, '/api/helo')
  // @ts-expect-error no PUT route matches '/api/hey'
  await serverFetch(event, '/api/hey', { method: 'put' })
  // @ts-expect-error no GET route matches '/api/validated'
  await serverFetch(event, '/api/validated')

  const path = '/api/hey' as string
  expectTypeOf(await serverFetch(event, path)).toEqualTypeOf<Response>()
  const method = 'get' as string
  expectTypeOf(await serverFetch(event, '/api/hey', { method })).toEqualTypeOf<Response>()

  await serverFetch(event, '/api/hey', { forwardHeaders: ['x-custom'], headers: { accept: 'application/json' } })
}
