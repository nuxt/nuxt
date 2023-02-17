/**
 * NuxtOptionsModule
 * Documentation: https://nuxtjs.org/api/configuration-modules
 *                https://nuxtjs.org/guide/modules
 */

import type { Configuration as WebpackConfiguration } from 'webpack'
import type { Nuxt } from '../nuxt'
import type { NuxtOptionsLoaders } from './build'
import type { NuxtRouteConfig } from './router'
import type { NuxtOptionsServerMiddleware } from './server-middleware'
import type { NuxtOptions } from '.'

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
  fileName?: string
  filename?: string
  options?: Record<string, any>
  [key: string]: any
}

export interface ModulePluginTemplateConfig extends ModuleTemplateConfig {
  ssr?: boolean
  mode?: 'all' | 'client' | 'server'
}

export interface ModuleTemplateDest {
  src: string
  dst: string
  options?: Record<string, any>
}

export type ModuleTemplate = ModuleTemplateConfig | string
export type ModulePluginTemplate = ModulePluginTemplateConfig | string

type ExtendRoutesFunction = (routes: NuxtRouteConfig[], resolve: (...pathSegments: string[]) => string) => void
type ExtendBuildFunction = (config: WebpackConfiguration, ctx: ExtendFunctionContext) => void

interface ModuleThis {
  addTemplate(template: ModuleTemplate): ModuleTemplateDest
  addPlugin(template: ModulePluginTemplate): void
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
  nuxt: Nuxt
  [key: string]: any
}

export type Module<T = any> = (this: ModuleThis, moduleOptions: T) => Promise<void> | void

export type NuxtOptionsModule = string | Module | [string | Module, any]
