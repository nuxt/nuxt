import type { NuxtConfig } from 'nuxt/schema'
import type { ConfigLayerMeta, DefineConfig } from 'c12'

export { NuxtConfig } from 'nuxt/schema'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DefineNuxtConfig extends DefineConfig<NuxtConfig, ConfigLayerMeta> {}
export declare const defineNuxtConfig: DefineNuxtConfig
