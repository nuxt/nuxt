/**
 * NuxtOptionsModule
 * Documentation: https://nuxtjs.org/api/configuration-modules
 *                https://nuxtjs.org/guide/modules
 */

import { Configuration as WebpackConfiguration } from 'webpack'
import { NuxtOptionsLoaders } from './build'
import { NuxtOptions } from '.'

interface ExtendFunctionContext {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
  loaders: NuxtOptionsLoaders
}

type ExtendFunction = (config: WebpackConfiguration, ctx: ExtendFunctionContext) => void

interface ModuleThis {
  extendBuild(fn: ExtendFunction): void
  options: NuxtOptions
  nuxt: any // TBD
  [key: string]: any // TBD
}

export type Module<T = any> = (this: ModuleThis, moduleOptions: T) => Promise<void> | void

export type NuxtOptionsModule = string | Module | [string | Module, any]
