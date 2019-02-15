import { NuxtConfigurationBuild } from './build'
import { NuxtConfigurationEnv } from './env'
import { NuxtConfigurationFetch } from './fetch'
import { NuxtConfigurationGenerate } from './generate'
import { NuxtConfigurationHead } from './head'
import { NuxtConfigurationHooks } from './hooks'
import { NuxtConfigurationGlobals } from './globals'
import { NuxtConfigurationLoading, NuxtConfigurationLoadingIndicator } from './loading'
import { NuxtConfigurationModule, NuxtModule } from './module'
import { NuxtConfigurationPlugin } from './plugin'
import { NuxtConfigurationRender } from './render'
import { NuxtConfigurationRouter } from './router'
import { NuxtConfigurationServer } from './server'
import { NuxtConfigurationServerMiddleware, NuxtServerMiddleware } from './server-middleware'
import { NuxtConfigurationVueConfiguration } from './vue-configuration'
import { NuxtConfigurationWatchers } from './watchers'

type ExtendableConfiguration = { [key: string]: any }

interface NuxtConfiguration extends ExtendableConfiguration {
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
  NuxtConfiguration,
  NuxtConfigurationBuild,
  NuxtConfigurationEnv,
  NuxtConfigurationFetch,
  NuxtConfigurationGenerate,
  NuxtConfigurationGlobals,
  NuxtConfigurationHead,
  NuxtConfigurationHooks,
  NuxtConfigurationLoading,
  NuxtConfigurationLoadingIndicator,
  NuxtConfigurationModule,
  NuxtConfigurationPlugin,
  NuxtConfigurationRender,
  NuxtConfigurationRouter,
  NuxtConfigurationServer,
  NuxtConfigurationServerMiddleware,
  NuxtConfigurationVueConfiguration,
  NuxtConfigurationWatchers,
  NuxtModule,
  NuxtServerMiddleware
}

export default NuxtConfiguration
