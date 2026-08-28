import { describe, expectTypeOf, it } from 'vitest'
import type * as UpstreamV2 from 'nitropack/types'
import type * as UpstreamV3 from 'nitro/types'

import type { NitroInstanceFallback, NitroInstanceOptionsFallback, ResolveNitroInstance, ResolveNitroInstanceOptions } from '../src/types/nitro.ts'

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
