import { describe, expectTypeOf, it } from 'vitest'

import { foo } from '#shared/other'

describe('shared folder', () => {
  it('can reference its own aliases', () => {
    expectTypeOf(foo).not.toBeAny()
    expectTypeOf(foo).toEqualTypeOf<string>()
  })
  it('can reference auto-imported utils', () => {
    expectTypeOf(useSharedUtil()).toEqualTypeOf<string>()
  })
})
