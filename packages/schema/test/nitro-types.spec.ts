import { describe, expectTypeOf, it } from 'vitest'
import type * as UpstreamV2 from 'nitropack/types'
import type * as UpstreamV3 from 'nitro/types'

import type { DevServerHandlerFallback, NitroConfigFallback, NitroInstanceFallback, NitroInstanceOptionsFallback, ResolveNitroInstance, ResolveNitroInstanceOptions, RouteRuleConfigFallback, ServerHandlerFallback, TracingChannelOptionsBase } from '../src/types/nitro.ts'

describe('fallback nitro instance shapes', () => {
  it('accept the instance and options of both upstream majors', () => {
    expectTypeOf<UpstreamV2.Nitro>().toExtend<NitroInstanceFallback>()
    expectTypeOf<UpstreamV2.NitroOptions>().toExtend<NitroInstanceOptionsFallback>()
    expectTypeOf<UpstreamV3.Nitro>().toExtend<NitroInstanceFallback>()
    expectTypeOf<UpstreamV3.NitroOptions>().toExtend<NitroInstanceOptionsFallback>()
  })

  it('declare no members that are missing from both upstream majors', () => {
    expectTypeOf<keyof NitroInstanceFallback>().toExtend<keyof UpstreamV2.Nitro | keyof UpstreamV3.Nitro>()
    expectTypeOf<keyof NitroInstanceOptionsFallback>().toExtend<keyof UpstreamV2.NitroOptions | keyof UpstreamV3.NitroOptions>()
  })

  it('do not narrow reads of options both majors resolve', () => {
    expectTypeOf<NitroInstanceOptionsFallback['dev']>().toEqualTypeOf<boolean>()
  })
})

describe('`NitroTypes` registry', () => {
  // `NitroInstance` resolves against whatever the surrounding program augmented into
  // `NitroTypes`, so the resolution is exercised through stand-in registries here
  it('resolves the instance and its options from a contributed instance type', () => {
    interface Contributed { instance: UpstreamV3.Nitro }

    expectTypeOf<ResolveNitroInstance<Contributed>>().toEqualTypeOf<UpstreamV3.Nitro>()
    expectTypeOf<ResolveNitroInstanceOptions<ResolveNitroInstance<Contributed>>>().toEqualTypeOf<UpstreamV3.NitroOptions>()
  })

  it('falls back when no instance type is contributed', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Empty {}

    expectTypeOf<ResolveNitroInstance<Empty>>().toEqualTypeOf<NitroInstanceFallback>()
    expectTypeOf<ResolveNitroInstanceOptions<ResolveNitroInstance<Empty>>>().toEqualTypeOf<NitroInstanceOptionsFallback>()
  })

  it('falls back when a contributed instance declares no options', () => {
    interface Partial { instance: { meta: { version: string } } }

    expectTypeOf<ResolveNitroInstanceOptions<ResolveNitroInstance<Partial>>>().toEqualTypeOf<NitroInstanceOptionsFallback>()
  })
})

describe('registry independence of the fallback shapes', () => {
  // a member typed through a registry key resolves to the builder's type once its augments are
  // in the program, so these read as the fallback here and as nitro's types in a nitro build
  it('type their members through the fallbacks rather than the resolved registry types', () => {
    expectTypeOf<NitroConfigFallback['handlers']>().toEqualTypeOf<ServerHandlerFallback[] | undefined>()
    expectTypeOf<NitroConfigFallback['devHandlers']>().toEqualTypeOf<DevServerHandlerFallback[] | undefined>()
    expectTypeOf<NitroConfigFallback['routeRules']>().toEqualTypeOf<Record<string, RouteRuleConfigFallback> | undefined>()
    expectTypeOf<NitroConfigFallback['tracingChannel']>().toEqualTypeOf<boolean | (TracingChannelOptionsBase & Record<string, boolean | undefined>) | undefined>()
    expectTypeOf<NitroInstanceOptionsFallback['handlers']>().toEqualTypeOf<Array<Record<string, any>>>()
    expectTypeOf<NitroInstanceOptionsFallback['devHandlers']>().toEqualTypeOf<Array<Record<string, any>>>()
    expectTypeOf<NitroInstanceFallback['scannedHandlers']>().toEqualTypeOf<Array<Record<string, any>>>()
    expectTypeOf<NitroInstanceFallback['options']>().toEqualTypeOf<NitroInstanceOptionsFallback>()
  })
})

describe('fallback server configuration shapes', () => {
  it('accept the handler registrations of both upstream majors', () => {
    expectTypeOf<UpstreamV2.NitroEventHandler>().toExtend<ServerHandlerFallback>()
    expectTypeOf<UpstreamV3.NitroEventHandler>().toExtend<ServerHandlerFallback>()
    expectTypeOf<UpstreamV2.NitroDevEventHandler>().toExtend<DevServerHandlerFallback>()
    expectTypeOf<UpstreamV3.NitroDevEventHandler>().toExtend<DevServerHandlerFallback>()
  })

  it('declare no members that are missing from both upstream majors', () => {
    expectTypeOf<keyof NitroConfigFallback>().toExtend<keyof UpstreamV2.NitroConfig | keyof UpstreamV3.NitroConfig>()
  })
})
