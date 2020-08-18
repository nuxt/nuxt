import path from 'path'
import type { WatchOptions as ChokidarWatchOptions } from 'chokidar'
import type { NextHandleFunction, Server as ConnectServer } from 'connect'
import type { configHooksT } from 'hookable/types/types'
import ignore from 'ignore'
import capitalize from 'lodash/capitalize'
import env from 'std-env'
import type { Configuration as WebpackConfiguration } from 'webpack'
import { TARGETS, MODES, Target, Mode } from 'src/utils'

import Hookable from 'hookable'
import type { NormalizedConfiguration } from '../options'

type IgnoreOptions = Parameters<typeof ignore>[0]
type IgnoreInstance = ReturnType<typeof ignore>

interface ExtendFunctionContext {
  isClient: boolean
  isDev: boolean
  isLegacy: boolean
  isModern: boolean
  isServer: boolean
  // TODO
  // loaders: NuxtOptionsLoaders
}

type ExtendFunction = (config: WebpackConfiguration, ctx: ExtendFunctionContext) => void

interface NuxtHooks extends configHooksT {

  build?: {
    before?(builder: any, buildOptions: any): void
    compile?(params: { name: 'client' | 'server', compiler: any }): void
    compiled?(params: { name: 'client' | 'server', compiler: any, stats: any }): void
    done?(builder: any): void
    extendRoutes?(routes: any, resolve: any): void
    templates?(params: { templateFiles: any, templateVars: any, resolve: any }): void
  }
  close?(nuxt: any): void
  error?(error: Error): void
  generate?: {
    before?(generator: any, generateOptions: any): void
    distCopied?(generator: any): void
    distRemoved?(generator: any): void
    done?(generator: any): void
    extendRoutes?(routes: any): void
    page?(params: { route: any, path: any, html: any }): void
    routeCreated?(route: any, path: any, errors: any): void
    routeFailed?(route: any, errors: any): void
  }
  listen?(server: any, params: { host: string, port: number | string }): void
  modules?: {
    before?(moduleContainer: any, options: any): void
    done?(moduleContainer: any): void
  }
  ready?(nuxt: any): void
  render?: {
    before?(renderer: any, options: any): void
    done?(renderer: any): void
    errorMiddleware?(app: ConnectServer): void
    resourcesLoaded?(resources: any): void
    route?(url: string, result: any, context: any): void
    routeContext?(context: any): void
    routeDone?(url: string, result: any, context: any): void
    beforeResponse?(url: string, result: any, context: any): void
    setupMiddleware?(app: ConnectServer): void
  }
}

interface ModuleThis {
  extendBuild(fn: ExtendFunction): void
  options: NormalizedConfiguration
  nuxt: any // TBD
  [key: string]: any // TBD
}

export type ModuleHandler<T = any> = (this: ModuleThis, moduleOptions: T) => Promise<void> | void

export type NuxtModule = string | ModuleHandler | [string | ModuleHandler, any]

export type ServerMiddleware = string | { path: string, prefix?: boolean, handler: string | NextHandleFunction } | NextHandleFunction

interface CommonConfiguration {
  _modules: NuxtModule[]
  _nuxtConfigFile?: string
  alias: Record<string, string>
  appDir: string,
  buildDir: string
  buildModules: NuxtModule[]
  createRequire?: (module: NodeJS.Module) => NodeJS.Require
  debug?: boolean
  dev: boolean
  dir: { [key in 'app' | 'assets' | 'layouts' | 'middleware' | 'pages' | 'static' | 'store']: string }
  editor: undefined
  env: NodeJS.ProcessEnv
  extensions: string[]
  globalName?: string,
  globals: {
    id: (globalName: string) => string
    nuxt: (globalName: string) => string
    context: (globalName: string) => string
    pluginPrefix: (globalName: string) => string
    readyCallback: (globalName: string) => string
    loadedCallback: (globalName: string) => string
  }
  hooks: null | ((hook: Hookable['hook']) => void) | NuxtHooks
  ignoreOptions?: IgnoreOptions
  ignorePrefix: string
  ignore: Array<string | IgnoreInstance>
  // TODO: remove in Nuxt 3
  mode: Mode
  modern?: boolean | 'client' | 'server'
  modules: NuxtModule[]
  privateRuntimeConfig: Record<string, any> | ((env: NodeJS.ProcessEnv) => Record<string, any>)
  publicRuntimeConfig: Record<string, any> | ((env: NodeJS.ProcessEnv) => Record<string, any>)
  serverMiddleware: Array<ServerMiddleware> | Record<string, NextHandleFunction>
  ssr: boolean
  target: Target
  test: boolean
  srcDir?: string
  modulesDir: string[]
  styleExtensions: string[]
  watch: string[]
  watchers: {
    webpack: WebpackConfiguration['watchOptions']
    chokidar: ChokidarWatchOptions
  }
}

export default (): CommonConfiguration => ({
  // Env
  dev: Boolean(env.dev),
  test: Boolean(env.test),
  debug: undefined, // = dev
  env: {},

  createRequire: undefined,

  // Target
  target: TARGETS.server,

  // Rendering
  ssr: true,

  // TODO: remove in Nuxt 3
  // Mode
  mode: MODES.universal,
  modern: undefined,

  // Modules
  modules: [],
  buildModules: [],
  _modules: [],

  globalName: undefined,
  globals: {
    id: globalName => `__${globalName}`,
    nuxt: globalName => `$${globalName}`,
    context: globalName => `__${globalName.toUpperCase()}__`,
    pluginPrefix: globalName => globalName,
    readyCallback: globalName => `on${capitalize(globalName)}Ready`,
    loadedCallback: globalName => `_on${capitalize(globalName)}Loaded`
  },

  // Server
  serverMiddleware: [],

  // Dirs and extensions
  _nuxtConfigFile: undefined,
  srcDir: undefined,
  buildDir: '.nuxt',
  modulesDir: [
    'node_modules'
  ],
  appDir: path.resolve(__dirname, '../../../app'),
  dir: {
    assets: 'assets',
    app: 'app',
    layouts: 'layouts',
    middleware: 'middleware',
    pages: 'pages',
    static: 'static',
    store: 'store'
  },
  extensions: [],
  styleExtensions: ['css', 'pcss', 'postcss', 'styl', 'stylus', 'scss', 'sass', 'less'],
  alias: {},

  // Ignores
  ignoreOptions: undefined,
  ignorePrefix: '_',
  ignore: [
    '**/*.test.*',
    '**/*.spec.*'
  ],

  // Watch
  watch: [],
  watchers: {
    webpack: {
      aggregateTimeout: 1000
    },
    chokidar: {
      ignoreInitial: true
    }
  },

  // Editor
  editor: undefined,

  // Hooks
  hooks: null,

  // runtimeConfig
  privateRuntimeConfig: {},
  publicRuntimeConfig: {}
})
