import { runtimeConfig } from '#nitro/virtual/runtime-config'
import schema, { strictPaths } from '#internal/nuxt/runtime-config-schema'
import { createRuntimeConfig } from '#internal/nuxt/host'

export const useRuntimeConfig = /* @__PURE__ */ createRuntimeConfig(runtimeConfig, schema, strictPaths)
