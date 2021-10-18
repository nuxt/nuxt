import { ConfigSchema as _ConfigSchema } from '../../schema/config'
import { ModuleInstallOptions } from './module'
import { NuxtHooks } from './hooks'

export interface ConfigSchema extends _ConfigSchema {
  hooks: NuxtHooks,
  modules: ModuleInstallOptions[]
  buildModules: ModuleInstallOptions[]
  [key: string]: any

  // TODO: Move to schema when untyped supports type annotation
  vite: boolean | import('vite').InlineConfig
}

export interface NuxtOptions extends ConfigSchema { }

type DeepPartial<T> = T extends Record<string, any> ? { [P in keyof T]?: DeepPartial<T[P]> | T[P] } : T

export interface NuxtConfig extends DeepPartial<ConfigSchema> { }
