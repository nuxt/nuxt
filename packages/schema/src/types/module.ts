import type { Defu } from 'defu'
import type { NuxtHooks } from './hooks'
import type { Nuxt } from './nuxt'
import type { NuxtCompatibility } from './compatibility'

export interface ModuleMeta {
  /** Module name. */
  name?: string

  /** Module version. */
  version?: string

  /**
   * The configuration key used within `nuxt.config` for this module's options.
   * For example, `@nuxtjs/axios` uses `axios`.
   */
  configKey?: string

  /**
   * Constraints for the versions of Nuxt or features this module requires.
   */
  compatibility?: NuxtCompatibility

  /**
   * Fully resolved path used internally by Nuxt. Do not depend on this value.
   * @internal
   */
  rawPath?: string

  [key: string]: unknown
}

/** The options received.  */
export type ModuleOptions = Record<string, any>

export type ModuleSetupInstallResult = {
  /**
   * Timing information for the initial setup
   */
  timings?: {
    /** Total time took for module setup in ms */
    setup?: number
    [key: string]: number | undefined
  }
}

type Awaitable<T> = T | Promise<T>

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {}

export type ModuleSetupReturn = Awaitable<false | void | ModuleSetupInstallResult>

export type ResolvedModuleOptions<
  TOptions extends ModuleOptions,
  TOptionsDefaults extends Partial<TOptions>,
> =
  Prettify<
    Defu<
      Partial<TOptions>,
      [Partial<TOptions>, TOptionsDefaults]
    >
  >

export interface ModuleDependencyMeta {
  version?: string
  overrides?: Record<string, unknown>
  defaults?: Record<string, unknown>
  optional?: boolean
}

/** Module definition passed to 'defineNuxtModule(...)' or 'defineNuxtModule().with(...)'. */
export interface ModuleDefinition<
  TOptions extends ModuleOptions,
  TOptionsDefaults extends Partial<TOptions>,
  TWith extends boolean,
> {
  meta?: ModuleMeta
  defaults?: TOptionsDefaults | ((nuxt: Nuxt) => Awaitable<TOptionsDefaults>)
  schema?: TOptions
  hooks?: Partial<NuxtHooks>
  // TODO: type constraints for module options
  moduleDependencies?: Record<string, ModuleDependencyMeta> | ((nuxt: Nuxt) => Record<string, ModuleDependencyMeta>)
  onInstall?: (nuxt: Nuxt) => Awaitable<void>
  onUpgrade?: (nuxt: Nuxt, options: TOptions, previousVersion: string) => Awaitable<void>
  setup?: (
    this: void,
    resolvedOptions: TWith extends true
      ? ResolvedModuleOptions<TOptions, TOptionsDefaults>
      : TOptions,
    nuxt: Nuxt
  ) => ModuleSetupReturn
}

export interface NuxtModule<
  TOptions extends ModuleOptions = ModuleOptions,
  TOptionsDefaults extends Partial<TOptions> = Partial<TOptions>,
  TWith extends boolean = false,
> {
  (
    this: void,
    resolvedOptions: TWith extends true
      ? ResolvedModuleOptions<TOptions, TOptionsDefaults>
      : TOptions,
    nuxt: Nuxt
  ): ModuleSetupReturn
  getOptions?: (
    inlineOptions?: Partial<TOptions>,
    nuxt?: Nuxt
  ) => Promise<
    TWith extends true
      ? ResolvedModuleOptions<TOptions, TOptionsDefaults>
      : TOptions
  >
  getModuleDependencies?: (nuxt: Nuxt) => Record<string, ModuleDependencyMeta> | undefined
  getMeta?: () => Promise<ModuleMeta>
  onInstall?: (nuxt: Nuxt) => Awaitable<void>
  onUpgrade?: (
    options: TWith extends true
      ? ResolvedModuleOptions<TOptions, TOptionsDefaults>
      : TOptions,
    nuxt: Nuxt,
    previousVersion: string
  ) => Awaitable<void>
}
