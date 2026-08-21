import { describe, expectTypeOf, it } from 'vitest'
import type * as UpstreamV2 from 'nitropack/types'
import type * as UpstreamV3 from 'nitro/types'

import type { Nitro, NitroDevEventHandlerV2, NitroDevEventHandlerV3, NitroEventHandlerV2, NitroEventHandlerV3, NitroOptions, NitroRouteConfig } from '../src/nitro-types.ts'

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
    expectTypeOf<UpstreamV2.NitroRouteConfig>().toExtend<NitroRouteConfig>()
  })

  it('accepts the upstream `Nitro` instance and options', () => {
    expectTypeOf<UpstreamV2.Nitro>().toExtend<Nitro>()
    expectTypeOf<UpstreamV2.NitroOptions>().toExtend<NitroOptions>()
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

  it('accepts the upstream `NitroRouteConfig`', () => {
    expectTypeOf<UpstreamV3.NitroRouteConfig>().toExtend<NitroRouteConfig>()
  })

  it('accepts the upstream `Nitro` instance and options', () => {
    expectTypeOf<UpstreamV3.Nitro>().toExtend<Nitro>()
    expectTypeOf<UpstreamV3.NitroOptions>().toExtend<NitroOptions>()
  })
})

describe('inlined `Nitro` shapes', () => {
  it('declare no members that are missing from both upstream majors', () => {
    expectTypeOf<keyof Nitro>().toExtend<keyof UpstreamV2.Nitro | keyof UpstreamV3.Nitro>()
    expectTypeOf<keyof NitroOptions>().toExtend<keyof UpstreamV2.NitroOptions | keyof UpstreamV3.NitroOptions>()
  })
})

describe('inlined `NitroRouteConfig`', () => {
  // upstream keys may be a superset here because nuxt augments `nitro/types`
  // within this repo; extra upstream keys are absorbed by the index signature
  it('declares no keys that are missing upstream', () => {
    expectTypeOf<KnownKeys<NitroRouteConfig>>().toExtend<keyof UpstreamV2.NitroRouteConfig | keyof UpstreamV3.NitroRouteConfig>()
  })
})
