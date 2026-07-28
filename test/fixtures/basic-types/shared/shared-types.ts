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

  it('can reference useRuntimeConfig', () => {
    const config = useRuntimeConfig()
    expectTypeOf(config).not.toBeAny()
    expectTypeOf(config.public).not.toBeAny()
  })

  it('can reference useAppConfig', () => {
    const config = useAppConfig()
    expectTypeOf(config).not.toBeAny()
  })

  it('types inline and schema app config but not app-context `app.config` files', () => {
    const config = useAppConfig()
    expectTypeOf(config.fromNuxtConfig).toEqualTypeOf<boolean>()
    expectTypeOf(config.userConfig).toEqualTypeOf<123 | 456 | undefined>()
    expectTypeOf(config.fromLayer).toEqualTypeOf<unknown>()
  })
})
