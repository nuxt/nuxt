import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { useServerHooks } from '../src/server/index'
import type { NuxtRenderHTMLContext } from '../src/app/types'
import type { RequestEvent, ServerHookResult } from '../src/server/index'

declare module 'nuxt/schema' {
  interface NuxtServerHooks {
    'test:hook': (payload: { value: number }, event: RequestEvent) => ServerHookResult
  }
}

describe('`useServerHooks` without a server builder', () => {
  it('returns one hookable shared across calls', async () => {
    const handler = vi.fn()
    const remove = useServerHooks().hook('test:hook', handler)
    const event = {} as RequestEvent
    await useServerHooks().callHook('test:hook', { value: 1 }, event)
    remove()
    await useServerHooks().callHook('test:hook', { value: 2 }, event)
    expect(handler.mock.calls).toEqual([[{ value: 1 }, event]])
  })

  it('types module and renderer hooks', () => {
    const hooks = useServerHooks()
    expectTypeOf(hooks.hook<'test:hook'>).parameter(1).parameters.toEqualTypeOf<[{ value: number }, RequestEvent]>()
    expectTypeOf(hooks.hook<'render:html'>).parameter(1).parameter(0).toEqualTypeOf<NuxtRenderHTMLContext>()
    // @ts-expect-error an undeclared hook
    hooks.hook('test:unknown', () => {})
  })
})
