/**
 * NuxtOptionsModule
 * Documentation: https://nuxtjs.org/api/configuration-modules
 *                https://nuxtjs.org/guide/modules
 */

import { Configuration as WebpackConfiguration } from 'webpack'
import { NuxtOptionsLoaders } from './build'
import { NuxtRouteConfig } from './router'
import { NuxtOptionsServerMiddleware } from './server-middleware'
import { NuxtOptions } from '.'

interface ExtendFunctionContext {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
  loaders: NuxtOptionsLoaders
}

export interface ModuleTemplateConfig {
  src: string,
  fileName?: string,
  options?: any
}

export interface ModuleTemplateDest {
  src: string
  dst: string
  options?: any
}

export type ModuleTemplate = ModuleTemplateConfig | string

type ExtendRoutesFunction = (routes: NuxtRouteConfig[], resolve: (...pathSegments: string[]) => string) => void
type ExtendBuildFunction = (config: WebpackConfiguration, ctx: ExtendFunctionContext) => void

interface ModuleThis {
  addTemplate(template: ModuleTemplate): ModuleTemplateDest
  addPlugin(template: ModuleTemplate): void
  addLayout(template: ModuleTemplate, name?: string): void
  addErrorLayout (dst: string): void
  addServerMiddleware (middleware: NuxtOptionsServerMiddleware): void
  extendBuild(fn: ExtendBuildFunction): void
  extendRoutes(fn: ExtendRoutesFunction): void
  // eslint-disable-next-line no-use-before-define
  requireModule (moduleOpts: NuxtOptionsModule, paths?: string[]): Promise<any>
  // eslint-disable-next-line no-use-before-define
  addModule (moduleOpts: NuxtOptionsModule, paths?: string[]): Promise<any>
  options: NuxtOptions
  nuxt: any // TBD
  [key: string]: any // TBD
}

export type Module<T = any> = (this: ModuleThis, moduleOptions: T) => Promise<void> | void

export type NuxtOptionsModule = string | Module | [string | Module, any]
