import { ConfigSchema } from '../../schema/config'
import { ModuleInstallOptions } from './module'
import { NuxtHooks } from './hooks'

export interface TypedConfigSchema extends ConfigSchema {
  hooks: NuxtHooks,
  modules: ModuleInstallOptions[]
  buildModules: ModuleInstallOptions[]

  /**
   * Enable vite mode
   *
   * @default false
   */
  vite: boolean | import('vite').InlineConfig
  [key: string]: any
}

export interface NuxtOptions extends TypedConfigSchema { }

type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> | T[P] }

export interface NuxtConfig extends DeepPartial<TypedConfigSchema> { }
