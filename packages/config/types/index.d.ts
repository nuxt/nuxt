import { NuxtConfigurationBuild } from './build'
import { NuxtConfigurationEnv } from './env'
import { NuxtConfigurationFetch } from './fetch'
import { NuxtConfigurationGenerate } from './generate'
import { NuxtConfigurationHead } from './head'
import { NuxtConfigurationHooks } from './hooks'
import { NuxtConfigurationGlobals } from './globals'
import { NuxtConfigurationLoading, NuxtConfigurationLoadingIndicator } from './loading'
import { NuxtConfigurationModule } from './module'
import { NuxtConfigurationPlugin } from './plugin'
import { NuxtConfigurationRender } from './render'
import { NuxtConfigurationRouter, NuxtRouteConfig } from './router'
import { NuxtConfigurationServer } from './server'
import { NuxtConfigurationServerMiddleware } from './server-middleware'
import { NuxtConfigurationVueConfiguration } from './vue-configuration'
import { NuxtConfigurationWatchers } from './watchers'

type ExtendableConfiguration = { [key: string]: any }

export default interface NuxtConfiguration extends ExtendableConfiguration {
  build?: NuxtConfigurationBuild
  buildDir?: string
  css?: string[]
  dev?: boolean
  env?: NuxtConfigurationEnv
  fetch?: NuxtConfigurationFetch
  generate?: NuxtConfigurationGenerate
  globalName?: string
  globals?: NuxtConfigurationGlobals
  head?: NuxtConfigurationHead
  hooks?: NuxtConfigurationHooks
  ignorePrefix?: string
  ignore?: string[]
  layoutTransition?: any // TBD - should be of type `Transition` already defined in @nuxt/vue-app
  loading?: NuxtConfigurationLoading | false | string
  loadingIndicator?: NuxtConfigurationLoadingIndicator | false | string
  mode?: 'spa' | 'universal' // TBR (To Be Reviewed) - should be a `NuxtMode` interface which should be used in @nuxt/vue-app/types/process.d.ts as well
  modern?: 'client' | 'server' | boolean
  modules?: NuxtConfigurationModule[]
  modulesDir?: string[]
  plugins?: NuxtConfigurationPlugin[]
  render?: NuxtConfigurationRender
  rootDir?: string
  router?: NuxtConfigurationRouter
  server?: NuxtConfigurationServer
  serverMiddleware?: NuxtConfigurationServerMiddleware[]
  srcDir?: string
  transition?: any // TBD - should be of type `Transition` already defined in @nuxt/vue-app
  'vue.config'?: NuxtConfigurationVueConfiguration
  watch?: string[]
  watchers?: NuxtConfigurationWatchers
}

export {
  NuxtConfigurationBuild as Build,
  NuxtConfigurationEnv as Env,
  NuxtConfigurationFetch as Fetch,
  NuxtConfigurationGenerate as Generate,
  NuxtConfigurationHead as Head,
  NuxtConfigurationHooks as Hooks,
  NuxtConfigurationGlobals as Globals,
  NuxtConfigurationLoading as Loading,
  NuxtConfigurationLoadingIndicator as LoadingIndicator,
  NuxtConfigurationModule as Module,
  NuxtConfigurationPlugin as Plugin,
  NuxtConfigurationRender as Render,
  NuxtConfigurationRouter as Router,
  NuxtRouteConfig as RouteConfig,
  NuxtConfigurationServer as Server,
  NuxtConfigurationServerMiddleware as ServerMiddleware,
  NuxtConfigurationVueConfiguration as VueConfiguration,
  NuxtConfigurationWatchers as Watchers
}

export namespace NuxtConfiguration {
  export type Build = NuxtConfigurationBuild
  export type Env = NuxtConfigurationEnv
  export type Fetch = NuxtConfigurationFetch
  export type Generate = NuxtConfigurationGenerate
  export type Head = NuxtConfigurationHead
  export type Hooks = NuxtConfigurationHooks
  export type Globals = NuxtConfigurationGlobals
  export type Loading = NuxtConfigurationLoading
  export type LoadingIndicator = NuxtConfigurationLoadingIndicator
  export type Module = NuxtConfigurationModule
  export type Plugin = NuxtConfigurationPlugin
  export type Render = NuxtConfigurationRender
  export type Router = NuxtConfigurationRouter
  export type Server = NuxtConfigurationServer
  export type ServerMiddleware = NuxtConfigurationServerMiddleware
  export type VueConfiguration = NuxtConfigurationVueConfiguration
  export type Watchers = NuxtConfigurationWatchers
}
