import { describe, expectTypeOf, it } from 'vitest'
import type * as UpstreamV2 from 'nitropack/types'
import type * as UpstreamV3 from 'nitro/types'

import type { NitroDevEventHandlerV2, NitroDevEventHandlerV3, NitroEventHandlerV2, NitroEventHandlerV3, NitroRouteConfig, NitroRouteConfigV2, NitroRouteConfigV3 } from '../src/nitro-types.ts'

type KnownKeys<T> = keyof { [K in keyof T as string extends K ? never : number extends K ? never : K]: 0 }

// `method` accepts both casings and `handler` shapes are widened on purpose;
// those fields are checked one-way (upstream must stay assignable to kit).
type Strict<T> = Omit<T, 'method' | 'handler'>

describe('inlined nitro v2 types', () => {
  it('matches the upstream `NitroEventHandler`', () => {
    expectTypeOf<keyof NitroEventHandlerV2>().toEqualTypeOf<keyof UpstreamV2.NitroEventHandler>()
    expectTypeOf<UpstreamV2.NitroEventHandler>().toExtend<NitroEventHandlerV2>()
    expectTypeOf<Strict<NitroEventHandlerV2>>().toExtend<Strict<UpstreamV2.NitroEventHandler>>()
    expectTypeOf<NitroEventHandlerV2['handler']>().toExtend<UpstreamV2.NitroEventHandler['handler']>()
    expectTypeOf<UpstreamV2.NitroEventHandler['method']>().toExtend<NitroEventHandlerV2['method']>()
  })

  it('matches the upstream `NitroDevEventHandler`', () => {
    expectTypeOf<keyof NitroDevEventHandlerV2>().toEqualTypeOf<keyof UpstreamV2.NitroDevEventHandler>()
    expectTypeOf<UpstreamV2.NitroDevEventHandler>().toExtend<NitroDevEventHandlerV2>()
    expectTypeOf<Strict<NitroDevEventHandlerV2>>().toExtend<Strict<UpstreamV2.NitroDevEventHandler>>()
  })

  it('accepts the upstream `NitroRouteConfig`', () => {
    expectTypeOf<UpstreamV2.NitroRouteConfig>().toExtend<NitroRouteConfigV2>()
    expectTypeOf<UpstreamV2.NitroRouteConfig>().toExtend<NitroRouteConfig>()
  })
})

describe('inlined nitro v3 types', () => {
  it('matches the upstream `NitroEventHandler`', () => {
    expectTypeOf<keyof NitroEventHandlerV3>().toEqualTypeOf<keyof UpstreamV3.NitroEventHandler>()
    expectTypeOf<UpstreamV3.NitroEventHandler>().toExtend<NitroEventHandlerV3>()
    expectTypeOf<Strict<NitroEventHandlerV3>>().toExtend<Strict<UpstreamV3.NitroEventHandler>>()
    expectTypeOf<NitroEventHandlerV3['handler']>().toExtend<UpstreamV3.NitroEventHandler['handler']>()
    expectTypeOf<UpstreamV3.NitroEventHandler['method']>().toExtend<NitroEventHandlerV3['method']>()
  })

  it('matches the upstream `NitroDevEventHandler`', () => {
    expectTypeOf<keyof NitroDevEventHandlerV3>().toEqualTypeOf<keyof UpstreamV3.NitroDevEventHandler>()
    expectTypeOf<UpstreamV3.NitroDevEventHandler>().toExtend<NitroDevEventHandlerV3>()
    expectTypeOf<Strict<NitroDevEventHandlerV3>>().toExtend<Strict<UpstreamV3.NitroDevEventHandler>>()
    expectTypeOf<UpstreamV3.NitroDevEventHandler['handler']>().toExtend<NitroDevEventHandlerV3['handler']>()
  })

  it('accepts the upstream `RouteRuleConfig`', () => {
    expectTypeOf<UpstreamV3.RouteRuleConfig>().toExtend<NitroRouteConfigV3>()
    expectTypeOf<UpstreamV3.RouteRuleConfig>().toExtend<NitroRouteConfig>()
  })
})

describe('inlined `NitroRouteConfig`', () => {
  // upstream keys may be a superset here because nuxt augments `nitro/types`
  // within this repo; extra upstream keys are absorbed by the index signature
  it('declares no keys that are missing upstream', () => {
    expectTypeOf<KnownKeys<NitroRouteConfigV2>>().toExtend<keyof UpstreamV2.NitroRouteConfig>()
    expectTypeOf<KnownKeys<NitroRouteConfigV3>>().toExtend<keyof UpstreamV3.RouteRuleConfig>()
  })

  it('does not accept a v3-only rule as nitro v2', () => {
    expectTypeOf<{ cors: { origin: string } }>().not.toExtend<NitroRouteConfigV2>()
    expectTypeOf<{ redirect: false }>().not.toExtend<NitroRouteConfigV2>()
    expectTypeOf<{ proxy: false }>().not.toExtend<NitroRouteConfigV2>()
  })

  it('accepts a rule that works on either nitro major', () => {
    expectTypeOf<{ prerender: true }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: { to: string, statusCode: number } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: { to: string, status: number } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ redirect: false }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ cors: { origin: string } }>().toExtend<NitroRouteConfig>()
    expectTypeOf<{ cors: true }>().toExtend<NitroRouteConfig>()
  })
})
