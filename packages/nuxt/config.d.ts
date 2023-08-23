import type { NuxtConfig } from 'nuxt/schema'
import type { DefineConfig, InputConfig, UserInputConfig, ConfigLayerMeta } from 'c12'
export { NuxtConfig } from 'nuxt/schema'

export interface DefineNuxtConfig extends DefineConfig<NuxtConfig, ConfigLayerMeta> {}
export declare const defineNuxtConfig: DefineNuxtConfig
