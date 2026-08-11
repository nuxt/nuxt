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

  // `AppConfig` is intentionally untyped in shared programs: user `app.config` files are not
  // importable there (#34140), and the shared declaration must not restate `AppConfig` with a
  // narrower type — a second declaration of the same interface in the same module is a TS2717
  // conflict that `skipLibCheck` hides and resolves by load order, silently dropping user-declared
  // app-config keys (#35996). The framework-default shape remains available as `SharedAppConfig`.
  it('does not type app-context `app.config` files in shared programs', () => {
    const config = useAppConfig()
    expectTypeOf(config.fromNuxtConfig).toEqualTypeOf<unknown>()
    expectTypeOf(config.userConfig).toEqualTypeOf<unknown>()
    expectTypeOf(config.fromLayer).toEqualTypeOf<unknown>()
  })
})
