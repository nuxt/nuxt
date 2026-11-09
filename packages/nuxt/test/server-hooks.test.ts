import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { useServerHooks } from '../src/server/index'
import { claimServerHooks } from '../src/server/hooks'
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

describe('`claimServerHooks`', () => {
  it('hands the first renderer the hooks registered before it, and a later one fresh hooks', async () => {
    const handler = vi.fn()
    const event = {} as RequestEvent
    useServerHooks().hook('test:hook', handler)

    const first = claimServerHooks()
    expect(first).toBe(useServerHooks())
    await first.callHook('test:hook', { value: 1 }, event)

    const second = claimServerHooks()
    expect(second).not.toBe(first)
    expect(useServerHooks()).toBe(second)
    await second.callHook('test:hook', { value: 2 }, event)

    expect(handler.mock.calls).toEqual([[{ value: 1 }, event]])
  })
})
