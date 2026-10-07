import { expectTypeOf } from 'vitest'
import { useRuntimeConfig as useNitroRuntimeConfig } from 'nitro/runtime-config'
import { useRuntimeConfig } from 'nuxt/server'

declare module 'nuxt/schema' {
  interface RuntimeConfig {
    serverOnlyModule?: { apiKey: string }
  }
}

expectTypeOf(useRuntimeConfig().serverOnlyModule).toEqualTypeOf<{ apiKey: string } | undefined>()
expectTypeOf(useNitroRuntimeConfig().serverOnlyModule).toEqualTypeOf<{ apiKey: string } | undefined>()
