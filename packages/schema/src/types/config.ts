import { ConfigSchema } from '../../schema/config'
import type { ResolvedConfig } from 'c12'

type DeepPartial<T> = T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> | T[P] } : T

/** User configuration in `nuxt.config` file */
export interface NuxtConfig extends DeepPartial<ConfigSchema> {
  [key: string]: any
}

/** Normalized Nuxt options available as `nuxt.options.*` */
export interface NuxtOptions extends ConfigSchema {
  _extends: ResolvedConfig<NuxtConfig>[]
}

export interface PublicRuntimeConfig extends Record<string, any> { }
export interface PrivateRuntimeConfig extends PublicRuntimeConfig { }

type _RuntimeConfig = PublicRuntimeConfig & Partial<PrivateRuntimeConfig>
export interface RuntimeConfig extends _RuntimeConfig { }
