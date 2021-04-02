import type { ModuleContainer } from '../module/container'
import { Nuxt } from './nuxt'
import { NuxtHooks } from './hooks'

export interface ModuleMeta {
  name?: string
  configKey?: string
  [key: string]: any
}

export type ModuleOptions = Record<string, any>

export interface LegacyNuxtModule {
  (this: ModuleContainer, inlineOptions?: ModuleOptions): void | Promise<void>
  meta?: ModuleMeta
}

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
  filename?: string
  fileName?: string
  options?: Record<string, any>
  src: string
}

export interface PluginTemplateOpts extends TemplateOpts {
  /** @deprecated use mode */
  ssr?: boolean
  mode?: 'all' | 'server' | 'client'
}
