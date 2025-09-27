import { describe, expectTypeOf, it } from 'vitest'
import { useRuntimeConfig } from '#imports'
import type { NitroRuntimeConfigApp } from 'nitropack/types'
import type { PublicRuntimeConfig } from 'nuxt/schema'

describe('runtime config', () => {
  it('should be correctly typed', () => {
    const config = useRuntimeConfig()

    expectTypeOf({ ...config, nitro: undefined }).toEqualTypeOf<{
      app: NitroRuntimeConfigApp
      nitro: undefined
      inlinedInTopLevel: string
      // TODO:
      // inlinedInKayer: string
      nested: {
        topLevel: string
        // TODO:
        // layer: string
      }
      public: PublicRuntimeConfig
    }>()

    expectTypeOf(config.public).toEqualTypeOf<{
      publicInlinedInTopLevel: number
      setByModule?: 'modules'
    }>()
  })
})
