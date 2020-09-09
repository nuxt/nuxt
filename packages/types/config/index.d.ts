import { Transition } from '../app'
import { NuxtOptionsBuild } from './build'
import { NuxtOptionsCli } from './cli'
import { NuxtOptionsEnv } from './env'
import { NuxtOptionsFeatures } from './features'
import { NuxtOptionsFetch } from './fetch'
import { NuxtOptionsGenerate } from './generate'
import { NuxtOptionsHead } from './head'
import { NuxtOptionsHooks } from './hooks'
import { NuxtOptionsGlobals } from './globals'
import { NuxtOptionsLoading, NuxtOptionsLoadingIndicator } from './loading'
import { NuxtOptionsModule } from './module'
import { NuxtOptionsPlugin } from './plugin'
import { NuxtOptionsRender } from './render'
import { NuxtOptionsRouter } from './router'
import { NuxtOptionsRuntimeConfig } from './runtime'
import { NuxtOptionsServer } from './server'
import { NuxtOptionsServerMiddleware } from './server-middleware'
import { NuxtOptionsVueConfiguration } from './vue-configuration'
import { NuxtOptionsWatchers } from './watchers'

export { Module } from './module'
export { ServerMiddleware } from './server-middleware'

/**
 * @deprecated Use NuxtConfig instead
*/
export interface Configuration extends Record<string, any> {}

export interface NuxtOptions extends Configuration {
  build: NuxtOptionsBuild
  buildDir: string
  buildModules: NuxtOptionsModule[]
  cli: NuxtOptionsCli
  css: string[]
  dev: boolean
  dir: { [key in 'app' | 'assets' | 'layouts' | 'middleware' | 'pages' | 'static' | 'store']?: string }
  env: NuxtOptionsEnv
  extensions: string[]
  features: NuxtOptionsFeatures
  fetch: NuxtOptionsFetch
  generate: NuxtOptionsGenerate
  export: NuxtOptionsGenerate
  globalName: string
  globals: NuxtOptionsGlobals
  head: NuxtOptionsHead
  hooks: NuxtOptionsHooks
  ignorePrefix: string
  ignore: string[]
  layoutTransition: Transition
  loading: NuxtOptionsLoading | false | string
  loadingIndicator: NuxtOptionsLoadingIndicator | false | string
  /** @deprecated Use ssr option instead */
  mode: 'spa' | 'universal'
  target: 'server' | 'static'
  modern: 'client' | 'server' | boolean
  modules: NuxtOptionsModule[]
  modulesDir: string[]
  plugins: NuxtOptionsPlugin[]
  privateRuntimeConfig: NuxtOptionsRuntimeConfig
  publicRuntimeConfig: NuxtOptionsRuntimeConfig
  render: NuxtOptionsRender
  rootDir: string
  router: NuxtOptionsRouter
  server: NuxtOptionsServer
  serverMiddleware: NuxtOptionsServerMiddleware[]
  srcDir: string
  transition: Transition
  'vue.config': NuxtOptionsVueConfiguration
  watch: string[]
  watchers: NuxtOptionsWatchers
}

export type NuxtConfig = Partial<NuxtOptions>
