import type { NuxtConfig, DefineNuxtConfig as _DefineNuxtConfig } from 'nuxt/schema'

export { NuxtConfig } from 'nuxt/schema'

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DefineNuxtConfig extends _DefineNuxtConfig<NuxtConfig> {}

export declare const defineNuxtConfig: DefineNuxtConfig
