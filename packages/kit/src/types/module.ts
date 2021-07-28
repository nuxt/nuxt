import type { ModuleContainer } from '../module/container'
import { Nuxt } from './nuxt'
import { NuxtHooks } from './hooks'

export interface ModuleMeta {
  /** The module name. */
  name?: string
  /**
   * The configuration key used within `nuxt.config` for this module's options.
   * For example, `@nuxtjs/axios` uses `axios`.
   */
  configKey?: string
  [key: string]: any
}

/** The options received  */
export type ModuleOptions = Record<string, any>

/** A pre-kit Nuxt module */
export interface LegacyNuxtModule {
  (this: ModuleContainer, inlineOptions?: ModuleOptions): void | Promise<void>
  meta?: ModuleMeta
}

/** A Nuxt module definition */
export interface NuxtModule<T extends ModuleOptions = any> extends ModuleMeta {
  defaults?: T
  setup?: (this: null, resolvedOptions: T, nuxt: Nuxt) => void | Promise<void>
  hooks?: Partial<NuxtHooks>
}

export type ModuleSrc = string | NuxtModule | LegacyNuxtModule

export interface ModuleInstallOptionsObj {
  src: ModuleSrc,
  meta: ModuleMeta
  options: ModuleOptions
  handler: LegacyNuxtModule
}

export type ModuleInstallOptions =
  ModuleSrc |
  [ModuleSrc, ModuleOptions?] |
  Partial<ModuleInstallOptionsObj>
