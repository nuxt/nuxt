import type {} from '@nuxt/nitro'
import type { NuxtConfig as _NuxtConfig } from '@nuxt/kit'

export interface BridgeConfig {
  nitro: boolean
  vite: boolean
  app: boolean | {}
  capi: boolean | {}
  scriptSetup: boolean
  autoImports: boolean
  transpile: boolean
  constraints: boolean
  postcss8: boolean
  resolve: boolean
  typescript: boolean
  meta: boolean | null
}

// TODO: Also inherit from @nuxt/types.NuxtConfig for legacy type compat
export interface NuxtConfig extends _NuxtConfig {
  bridge?: Partial<BridgeConfig> | false
}

declare module '@nuxt/kit' {
  interface ConfigSchema {
    bridge: BridgeConfig
  }
}

export declare function defineNuxtConfig(config: NuxtConfig): NuxtConfig
