import { describe, expectTypeOf, it } from 'vitest'
import type { NitroInstance, NitroInstanceOptions } from '@nuxt/kit'
import type { RequestEvent } from '@nuxt/schema'
import type { Nitro, NitroOptions } from 'nitropack/types'
import type { H3Event } from 'h3'
import type { NuxtSSRContext } from '#app/types'

import type {} from '../src/augments.ts'

describe('contributed nitro instance types', () => {
  it('resolves `NitroInstance` to the instance this builder constructs', () => {
    expectTypeOf<NitroInstance>().toEqualTypeOf<Nitro>()
    expectTypeOf<NitroInstanceOptions>().toEqualTypeOf<NitroOptions>()
  })

  it('exposes options that modules read off the instance', () => {
    expectTypeOf<NitroInstanceOptions['dev']>().toEqualTypeOf<boolean>()
    expectTypeOf<NitroInstanceOptions['_config']>().toEqualTypeOf<NitroOptions['_config']>()
    expectTypeOf<NitroInstanceOptions['handlers']>().toEqualTypeOf<NitroOptions['handlers']>()
  })
})

describe('contributed request event type', () => {
  it('resolves `RequestEvent` to the event this builder hands to the app layer', () => {
    expectTypeOf<RequestEvent>().toEqualTypeOf<H3Event>()
    expectTypeOf<NuxtSSRContext['event']>().toEqualTypeOf<H3Event>()
  })
})
