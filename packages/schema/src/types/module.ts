import { NuxtHooks } from './hooks'
import type { Nuxt, NuxtPluginTemplate, NuxtTemplate } from "./nuxt"
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
export interface NuxtModule<T extends ModuleOptions = ModuleOptions> {
  (this: void, inlineOptions: T, nuxt: Nuxt): void | Promise<void>
  getOptions?: (inlineOptions?: T, nuxt?: Nuxt) => Promise<T>
  getMeta?: () => Promise<ModuleMeta>
}

/**
* Legacy ModuleContainer for backwards compatibility with Nuxt 2 module format.
*/
export interface ModuleContainer {
  nuxt: Nuxt
  options: Nuxt['options']

  /** @deprecated */
  ready(): Promise<any>

  /** @deprecated */
  addVendor(): void

  /** Renders given template using lodash template during build into the project buildDir (`.nuxt`).*/
  addTemplate(template: string | NuxtTemplate): NuxtTemplate

  /** Registers a custom plugin. */
  addPlugin(template: NuxtPluginTemplate): NuxtPluginTemplate

  /** Registers a custom layout. If its name is 'error' it will override the default error layout. */
  addLayout(tmpl: NuxtTemplate, name: string): any

  /** Sets the layout that will render Nuxt errors. It should already have been added via addLayout or addTemplate. */
  addErrorLayout(dst: string): void

  /** Adds a new server middleware to the end of the server middleware array. */
  addServerMiddleware(arg1: any): void

  /** Allows extending webpack build config by chaining `options.build.extend` function. */
  extendBuild(fn: Function): void

  /** Allows extending routes by chaining `options.router.extendRoutes` function. */
  extendRoutes(fn: Function): void

  /** Registers a module. */
  requireModule(installOptions: any, opts: any): Promise<void>

  /** Registers a module. */
  addModule(installOptions: any, opts: any): Promise<void>
}
