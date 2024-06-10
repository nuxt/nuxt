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

export type ResolvedModuleOptions<TOptions extends ModuleOptions, TOptionsDefaults extends Partial<TOptions>> = Prettify<
    Defu<
        Partial<TOptions>,
        [Partial<TOptions>, TOptionsDefaults]
    >
>

/** Module definition passed to 'defineNuxtModule(...)' or 'defineNuxtModule().with(...)'. */
export interface ModuleDefinition<
  TOptions extends ModuleOptions,
  TOptionsDefaults extends Partial<TOptions> = Partial<TOptions>,
> {
  meta?: ModuleMeta
  defaults?: TOptionsDefaults | ((nuxt: Nuxt) => TOptionsDefaults)
  schema?: TOptions
  hooks?: Partial<NuxtHooks>
  setup?: (this: void, resolvedOptions: ResolvedModuleOptions<TOptions, TOptionsDefaults>, nuxt: Nuxt) => ModuleSetupReturn
}

export interface NuxtModule<
  TOptions extends ModuleOptions = ModuleOptions,
  TOptionsDefaults extends Partial<TOptions> = Partial<TOptions>,
> {
  (this: void, resolvedOptions: ResolvedModuleOptions<TOptions, TOptionsDefaults>, nuxt: Nuxt): ModuleSetupReturn
  getOptions?: (inlineOptions?: Partial<TOptions>, nuxt?: Nuxt) => Promise<ResolvedModuleOptions<TOptions, TOptionsDefaults>>
  getMeta?: () => Promise<ModuleMeta>
}
