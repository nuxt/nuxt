import type { Transition } from '../app'
import type { NuxtOptionsBuild } from './build'
import type { NuxtOptionsCli } from './cli'
import type { NuxtOptionsEnv } from './env'
import type { NuxtOptionsFeatures } from './features'
import type { NuxtOptionsFetch } from './fetch'
import type { NuxtOptionsGenerate } from './generate'
import type { NuxtOptionsHead } from './head'
import type { NuxtOptionsHooks } from './hooks'
import type { NuxtOptionsGlobals } from './globals'
import type { NuxtOptionsLoading, NuxtOptionsLoadingIndicator } from './loading'
import type { NuxtOptionsModule } from './module'
import type { NuxtOptionsPlugin } from './plugin'
import type { NuxtOptionsRender } from './render'
import type { NuxtOptionsRouter } from './router'
import type { NuxtOptionsRuntimeConfig } from './runtime'
import type { NuxtOptionsServer } from './server'
import type { NuxtOptionsServerMiddleware } from './server-middleware'
import type { NuxtOptionsVueConfiguration } from './vue-configuration'
import type { NuxtOptionsWatchers } from './watchers'

export { Module } from './module'
export { ServerMiddleware } from './server-middleware'

/**
 * @deprecated Use NuxtConfig instead
*/
export interface Configuration extends Record<string, any> {}

export interface NuxtOptions extends Configuration {
  alias: Record<string, string>
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
  ssr: boolean
  transition: Transition
  vue: {
    config?: NuxtOptionsVueConfiguration
  }
  watch: string[]
  watchers: NuxtOptionsWatchers
}

export interface NuxtConfig extends Partial<NuxtOptions> {}
