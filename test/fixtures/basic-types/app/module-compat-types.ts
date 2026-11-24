import { describe, expectTypeOf, it } from 'vitest'
import type { CookieSerializeOptions } from '#app/types/cookie'
import type { CookieOptions, UseCookieOptions } from '#app'
import { useCookie } from '#imports'

describe('module compatibility', () => {
  it('CookieOptions is assignable to CookieSerializeOptions', () => {
    expectTypeOf<CookieOptions>().toExtend<CookieSerializeOptions>()
    useCookie('lazy', { expires: () => new Date() })
    useCookie('static', { expires: new Date() })
    expectTypeOf<UseCookieOptions['expires']>().toEqualTypeOf<Date | (() => Date | undefined) | undefined>()
  })
})
