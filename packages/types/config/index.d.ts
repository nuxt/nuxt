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
import { NuxtOptionsServer } from './server'
import { NuxtOptionsServerMiddleware } from './server-middleware'
import { NuxtOptionsVueConfiguration } from './vue-configuration'
import { NuxtOptionsWatchers } from './watchers'

export { Module } from './module'
export { ServerMiddleware } from './server-middleware'

export interface NuxtOptions extends Record<string, any> {
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
  mode: 'spa' | 'universal'
  target: 'server' | 'static'
  modern: 'client' | 'server' | boolean
  modules: NuxtOptionsModule[]
  modulesDir: string[]
  plugins: NuxtOptionsPlugin[]
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

/**
 * @deprecated Use NuxtConfig instead
*/
export type Configuration = NuxtConfig // Legacy alias
