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

// -- Templates --

export interface TemplateOpts {
  /** The target filename once the template is copied into the Nuxt buildDir */
  filename?: string
  /** The target filename once the template is copied into the Nuxt buildDir */
  fileName?: string
  /** An options object that will be accessible within the template via `<% options %>` */
  options?: Record<string, any>
  /** The resolved path to the source file to be templated */
  src: string
}

export interface PluginTemplateOpts extends TemplateOpts {
  /** @deprecated use mode */
  ssr?: boolean
  /** Whether the plugin will be loaded on only server-side, only client-side or on both. */
  mode?: 'all' | 'server' | 'client'
}
