import { describe, expectTypeOf, it } from 'vitest'
import type { H3Event } from 'h3'

import type { AppRouteRulesBase, NuxtRequestEvent, RequestEvent, ResolveAppRouteRules, ResolveRequestEvent } from '../src/types/server.ts'

describe('web-standard request event shape', () => {
  it('is satisfied by an event of a real server runtime', () => {
    expectTypeOf<H3Event>().toExtend<RequestEvent>()
  })

  it('describes the request, its URL and the response to be sent', () => {
    expectTypeOf<RequestEvent['req']>().toEqualTypeOf<Request>()
    expectTypeOf<RequestEvent['url']>().toEqualTypeOf<URL>()
    expectTypeOf<RequestEvent['res']['status']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<RequestEvent['res']['headers']>().toEqualTypeOf<Headers>()
  })
})

describe('`ServerTypes` registry', () => {
  // `NuxtRequestEvent` resolves against whatever the surrounding program augmented into
  // `ServerTypes`, so the resolution is exercised through stand-in registries here
  it('resolves the event from a contributed event type', () => {
    interface Contributed { event: H3Event }

    expectTypeOf<ResolveRequestEvent<Contributed>>().toEqualTypeOf<H3Event>()
  })

  it('falls back when no event type is contributed', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Empty {}

    expectTypeOf<ResolveRequestEvent<Empty>>().toEqualTypeOf<RequestEvent>()
  })

  it('resolves `NuxtRequestEvent` through the registry', () => {
    // a superset of the web-standard event where the surrounding program contributes one
    expectTypeOf<NuxtRequestEvent>().toExtend<RequestEvent>()
  })
})

describe('app-facing route rules', () => {
  it('resolves the rules contributed by a server builder alongside the app-facing ones', () => {
    interface Contributed { routeRules: { swr?: number | boolean } }

    expectTypeOf<ResolveAppRouteRules<Contributed>['swr']>().toEqualTypeOf<number | boolean | undefined>()
    expectTypeOf<ResolveAppRouteRules<Contributed>['prerender']>().toEqualTypeOf<boolean | undefined>()
  })

  it('describes an app-facing rule as the app layer reads it, not as the builder declares it', () => {
    interface Contributed { routeRules: { redirect?: { to: string, status: number } } }

    expectTypeOf<ResolveAppRouteRules<Contributed>['redirect']>().toEqualTypeOf<string | undefined>()
  })

  it('falls back to the app-facing rules when a builder contributes none', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Empty {}

    expectTypeOf<ResolveAppRouteRules<Empty>>().toExtend<AppRouteRulesBase>()
    expectTypeOf<AppRouteRulesBase>().toExtend<ResolveAppRouteRules<Empty>>()
  })
})
