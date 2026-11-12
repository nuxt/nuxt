import { runtimeConfig } from '#nitro/virtual/runtime-config'
import schema from '#internal/nuxt/runtime-config-schema'
import { createRuntimeConfig } from 'nuxt/internal/runtime-config'

export const useRuntimeConfig = /* @__PURE__ */ createRuntimeConfig(runtimeConfig, schema)
