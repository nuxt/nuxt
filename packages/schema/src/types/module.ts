import { NuxtHooks } from './hooks'
import type { Nuxt, NuxtTemplate } from "./nuxt";


export interface NuxtCompatibilityConstraints {
  /**
   * Required nuxt version. for example, `^2.14.0` or `>=3.0.0-27219851.6e49637`.
   */
  nuxt?: string
}

export interface NuxtCompatibilityIssue {
  name: string
  message: string
}

export interface NuxtCompatibilityIssues extends Array<NuxtCompatibilityIssue> {
  /**
   * Return formatted error message
   */
  toString(): string
}

export interface ModuleMeta {
  /** Module name */
  name?: string

  /** Module version */
  version?: string

  /**
   * The configuration key used within `nuxt.config` for this module's options.
   * For example, `@nuxtjs/axios` uses `axios`.
   */
  configKey?: string

  /**
   * Semver constraints for the versions of Nuxt or features this module are supported.
   */
  requires?: NuxtCompatibilityConstraints

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

  /** Register a custom layout. If its name is 'error' it will override the default error layout. */
  addLayout(tmpl: NuxtTemplate, name: string): any

  /** Set the layout that will render Nuxt errors. It should already have been added via addLayout or addTemplate. */
  addErrorLayout(dst: string): void

  /** Adds a new server middleware to the end of the server middleware array. */
  addServerMiddleware(arg1: any): void

  /** Allows extending webpack build config by chaining `options.build.extend` function. */
  extendBuild(fn): void

  /** Allows extending routes by chaining `options.build.extendRoutes` function. */
  extendRoutes(fn): void

  /** Registers a module */
  requireModule(nuxt: Nuxt, opts: any): Promise<void>

  /** Registers a module */
  addModule(nuxt: Nuxt, opts: any): Promise<void>
}
