import { describe, expectTypeOf, it } from 'vitest'
import type { H3Event } from 'h3'
import type { H3Event as WebEvent } from 'h3-next'

import type { RequestEventFallback, ResolveRequestEvent } from '../src/types/server.ts'

describe('fallback request event shape', () => {
  it('is satisfied by an event of a real server runtime', () => {
    expectTypeOf<WebEvent>().toExtend<RequestEventFallback>()
  })

  it('describes the request, its URL and the response to be sent', () => {
    expectTypeOf<RequestEventFallback['req']>().toEqualTypeOf<Request>()
    expectTypeOf<RequestEventFallback['url']>().toEqualTypeOf<URL>()
    expectTypeOf<RequestEventFallback['res']['status']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<RequestEventFallback['res']['headers']>().toEqualTypeOf<Headers>()
  })
})

describe('`ServerTypes` registry', () => {
  // `RequestEvent` resolves against whatever the surrounding program augmented into
  // `ServerTypes`, so the resolution is exercised through stand-in registries here
  it('resolves the event from a contributed event type', () => {
    interface Contributed { event: H3Event }

    expectTypeOf<ResolveRequestEvent<Contributed>>().toEqualTypeOf<H3Event>()
  })

  it('falls back when no event type is contributed', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Empty {}

    expectTypeOf<ResolveRequestEvent<Empty>>().toEqualTypeOf<RequestEventFallback>()
  })
})
