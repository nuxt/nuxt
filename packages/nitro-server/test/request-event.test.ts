import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'

import { toRequestEvent } from '../src/runtime/utils/event.ts'

describe('toRequestEvent', () => {
  it('does not share the prerender hints of the fetching request', () => {
    const event = {
      path: '/',
      context: {},
      node: { req: { __unenv__: { nuxt: { prerenderRoutes: ['/__nuxt_island/Island_abc.json'] } } } },
    } as unknown as H3Event
    toRequestEvent(event)
    expect(event.context.nuxt?.prerenderRoutes).toBeUndefined()
  })
})
