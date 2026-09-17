import { describe, expectTypeOf, it } from 'vitest'
import type { CookieSerializeOptions as UpstreamOptions } from 'cookie-es'
import type { CookieSerializeOptions } from '../src/app/types/cookie.ts'

// options are declared here but serialised by `cookie-es`, and assignability alone would not
// catch an attribute added upstream, so the key sets are compared in both directions
describe('CookieSerializeOptions', () => {
  it('accepts every attribute `cookie-es` serialises', () => {
    expectTypeOf<keyof UpstreamOptions>().toEqualTypeOf<keyof CookieSerializeOptions>()
  })

  it('is accepted by `cookie-es`', () => {
    expectTypeOf<CookieSerializeOptions>().toExtend<UpstreamOptions>()
  })
})
