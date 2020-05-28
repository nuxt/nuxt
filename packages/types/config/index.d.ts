import { Transition } from '../app'
import { NuxtConfigurationBuild } from './build'
import { NuxtConfigurationCli } from './cli'
import { NuxtConfigurationEnv } from './env'
import { NuxtConfigurationFeatures } from './features'
import { NuxtConfigurationFetch } from './fetch'
import { NuxtConfigurationGenerate } from './generate'
import { NuxtConfigurationHead } from './head'
import { NuxtConfigurationHooks } from './hooks'
import { NuxtConfigurationGlobals } from './globals'
import { NuxtConfigurationLoading, NuxtConfigurationLoadingIndicator } from './loading'
import { NuxtConfigurationModule, Module } from './module'
import { NuxtConfigurationPlugin } from './plugin'
import { NuxtConfigurationRender } from './render'
import { NuxtConfigurationRouter } from './router'
import { NuxtConfigurationServer } from './server'
import { NuxtConfigurationServerMiddleware, ServerMiddleware } from './server-middleware'
import { NuxtConfigurationVueConfiguration } from './vue-configuration'
import { NuxtConfigurationWatchers } from './watchers'

export interface Configuration extends Record<string, any> {
  build?: NuxtConfigurationBuild
  buildDir?: string
  buildModules?: NuxtConfigurationModule[]
  cli?: NuxtConfigurationCli
  css?: string[]
  dev?: boolean
  dir?: { [key in 'app' | 'assets' | 'layouts' | 'middleware' | 'pages' | 'static' | 'store']?: string }
  env?: NuxtConfigurationEnv
  extensions?: string[]
  features?: NuxtConfigurationFeatures
  fetch?: NuxtConfigurationFetch
  generate?: NuxtConfigurationGenerate
  globalName?: string
  globals?: NuxtConfigurationGlobals
  head?: NuxtConfigurationHead
  hooks?: NuxtConfigurationHooks
  ignorePrefix?: string
  ignore?: string[]
  layoutTransition?: Transition
  loading?: NuxtConfigurationLoading | false | string
  loadingIndicator?: NuxtConfigurationLoadingIndicator | false | string
  mode?: 'spa' | 'universal'
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
  transition?: Transition
  'vue.config'?: NuxtConfigurationVueConfiguration
  watch?: string[]
  watchers?: NuxtConfigurationWatchers
}

export {
  Module,
  ServerMiddleware
}
