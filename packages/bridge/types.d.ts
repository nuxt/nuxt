/// <reference types="nitropack" />
import type { NuxtConfig as _NuxtConfig } from '@nuxt/schema'
import type { MetaInfo } from 'vue-meta'
import type { PluginOptions as ScriptSetupPluginOptions } from 'unplugin-vue2-script-setup/dist'

export type ScriptSetupOptions = ScriptSetupPluginOptions

export interface BridgeConfig {
  nitro: boolean
  vite: boolean
  app: boolean | {}
  capi: boolean | {
    legacy?: boolean
  }
  scriptSetup: boolean | ScriptSetupOptions
  autoImports: boolean
  transpile: boolean
  compatibility: boolean
  postcss8: boolean
  resolve: boolean
  typescript: boolean
  meta: boolean | null
}

// TODO: Also inherit from @nuxt/types.NuxtConfig for legacy type compat
export interface NuxtConfig extends _NuxtConfig {
  head?: _NuxtConfig['head'] | MetaInfo
}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    bridge?: Partial<BridgeConfig> | false
  }
}

export declare function defineNuxtConfig(config: NuxtConfig): NuxtConfig
