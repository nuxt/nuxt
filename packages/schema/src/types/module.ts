import type { NuxtHooks } from './hooks'
import type { Nuxt } from "./nuxt"
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

  [key: string]: any
}

/** The options received.  */
export type ModuleOptions = Record<string, any>

/** Input module passed to defineNuxtModule. */
export interface ModuleDefinition<T extends ModuleOptions = ModuleOptions> {
  meta?: ModuleMeta
  defaults?: T | ((nuxt: Nuxt) => T)
  schema?: T
  hooks?: Partial<NuxtHooks>
  setup?: (this: void, resolvedOptions: T, nuxt: Nuxt) => void | Promise<void>
}

/** Nuxt modules are always a simple function. */
type Awaitable<T> = T | Promise<T>
export interface NuxtModule<T extends ModuleOptions = ModuleOptions> {
  (this: void, inlineOptions: T, nuxt: Nuxt): Awaitable<void | false>
  getOptions?: (inlineOptions?: T, nuxt?: Nuxt) => Promise<T>
  getMeta?: () => Promise<ModuleMeta>
}
