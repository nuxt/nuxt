import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'node:http'
import type { Server as HttpsServer } from 'node:https'
import type { Compiler, Configuration, Stats } from 'webpack'
import type { TSConfig } from 'pkg-types'
import type { InlineConfig as ViteInlineConfig, ViteDevServer } from 'vite'
import type { Manifest } from 'vue-bundle-renderer'
import type { ModuleContainer } from './module'
import type { NuxtTemplate, Nuxt, NuxtApp } from './nuxt'
import type { Preset as ImportPreset, Import } from 'unimport'
import type { NuxtConfig, NuxtOptions } from './config'
import type { Nitro, NitroConfig } from 'nitropack'
import type { Component, ComponentsDir, ScanDir, ComponentsOptions } from './components'
import { NuxtCompatibility, NuxtCompatibilityIssues } from '..'


type HookResult = Promise<void> | void

type Builder = any
type Generator = any
type Server = any

type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
interface PreloadFile {
  asType: 'script' | 'style' | 'font'
  extension: string
  file: string
  fileWithoutQuery: string
}
type RenderResult = {
  html: string
  cspScriptSrcHashes: string[]
  error: any
  redirected: boolean
  preloadFiles: PreloadFile[]
}

// https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html
export type TSReference = { types: string } | { path: string }

export type NuxtPage = {
  name?: string
  path: string
  file: string
  meta?: Record<string, any>
  children?: NuxtPage[]
}

export type NuxtMiddleware = {
  name: string
  path: string
  global?: boolean
}

export type NuxtLayout = {
  name: string
  file: string
}

export interface ImportPresetWithDeprecation extends ImportPreset {
  /**
   * @deprecated renamed to `imports`
   */
  names?: string[]
}

export interface NuxtHooks {
  // Kit
  'kit:compatibility': (compatibility: NuxtCompatibility, issues: NuxtCompatibilityIssues) => HookResult

  // nuxt
  'app:resolve': (app: NuxtApp) => HookResult
  'app:templates': (app: NuxtApp) => HookResult
  'app:templatesGenerated': (app: NuxtApp) => HookResult
  'builder:generateApp': () => HookResult
  'pages:extend': (pages: NuxtPage[]) => HookResult
  'build:manifest': (manifest: Manifest) => HookResult

  // Auto imports
  'autoImports:sources': (presets: ImportPresetWithDeprecation[]) => HookResult
  'autoImports:extend': (imports: Import[]) => HookResult
  'autoImports:dirs': (dirs: string[]) => HookResult

  // Components
  'components:dirs': (dirs: ComponentsOptions['dirs']) => HookResult
  'components:extend': (components: (Component | ComponentsDir | ScanDir)[]) => HookResult

  // @nuxt/builder
  'build:before':
  (builder: Builder, buildOptions: NuxtOptions['build']) => HookResult
  'builder:prepared': (builder: Builder, buildOptions: NuxtOptions['build']) => HookResult
  'builder:extendPlugins': (plugins: NuxtOptions['plugins']) => HookResult
  'build:templates': (templates: {
    templateVars: Record<string, any>,
    templatesFiles: NuxtTemplate[],
    resolve: (...args: string[]) => string
  }) => HookResult
  'build:extendRoutes': (routes: any[], resolve: (...args: string[]) => string) => HookResult
  'build:done': (builder: Builder) => HookResult
  'watch:restart': (event: { event: string, path: string }) => HookResult
  // 'watch:fileChanged': (builder: Builder, fileName: string) => HookResult
  'builder:watch': (event: WatchEvent, path: string) => HookResult

  // nitropack
  'nitro:config': (nitroConfig: NitroConfig) => HookResult
  'nitro:init': (nitro: Nitro) => HookResult
  'nitro:build:before': (nitro: Nitro) => HookResult

  // @nuxt/cli
  'generate:cache:ignore': (ignore: string[]) => HookResult
  'config': (options: NuxtConfig) => HookResult
  'run:before': (options: { argv: string[], cmd: { name: string, usage: string, description: string, options: Record<string, any> }, rootDir: string }) => HookResult

  // nuxi
  'build:error': (error: Error) => HookResult
  'prepare:types': (options: { references: TSReference[], declarations: string[], tsConfig: TSConfig }) => HookResult

  // @nuxt/core
  'ready': (nuxt: Nuxt) => HookResult
  'close': (nuxt: Nuxt) => HookResult
  'modules:before': (moduleContainer: ModuleContainer, modules?: any[]) => HookResult
  'modules:done': (moduleContainer: ModuleContainer) => HookResult
  // 'webpack:done': () => HookResult

  // @nuxt/server
  'render:before': (server: Server, renderOptions: NuxtOptions['render']) => HookResult
  'render:setupMiddleware': (app: any) => HookResult
  'render:errorMiddleware': (app: any) => HookResult
  'render:done': (server: Server) => HookResult
  'listen': (listenerServer: HttpServer | HttpsServer, listener: any) => HookResult
  'server:nuxt:renderLoading': (req: IncomingMessage, res: ServerResponse) => HookResult
  'render:route': (url: string, result: RenderResult, context: any) => HookResult
  'render:routeDone': (url: string, result: RenderResult, context: any) => HookResult
  'render:beforeResponse': (url: string, result: RenderResult, context: any) => HookResult

  // @nuxt/vue-renderer
  'render:resourcesLoaded': (resources: any) => HookResult
  'vue-renderer:context': (renderContext: any) => HookResult
  'vue-renderer:spa:prepareContext': (renderContext: any) => HookResult
  'vue-renderer:spa:templateParams': (templateParams: Record<string, any>) => HookResult
  'vue-renderer:ssr:prepareContext': (renderContext: any) => HookResult
  'vue-renderer:ssr:context': (renderContext: any) => HookResult
  // '_render:context': (nuxt: Nuxt) => HookResult
  // 'render:routeContext': (renderContext: any) => HookResult
  'vue-renderer:ssr:csp': (cspScriptSrcHashes: string[]) => HookResult
  'vue-renderer:ssr:templateParams': (templateParams: Record<string, any>, renderContext: any) => HookResult

  // @nuxt/webpack
  'webpack:config': (webpackConfigs: Configuration[]) => HookResult
  'webpack:devMiddleware': (middleware: (req: IncomingMessage, res: ServerResponse, next: (err?: any) => any) => any) => HookResult
  'webpack:hotMiddleware': (middleware: (req: IncomingMessage, res: ServerResponse, next: (err?: any) => any) => any) => HookResult
  'build:compile': (options: { name: string, compiler: Compiler }) => HookResult
  'build:compiled': (options: { name: string, compiler: Compiler, stats: Stats }) => HookResult
  'build:resources': (mfs?: Compiler['outputFileSystem']) => HookResult
  'server:devMiddleware': (middleware: (req: IncomingMessage, res: ServerResponse, next: (err?: any) => any) => any) => HookResult
  'bundler:change': (shortPath: string) => void
  'bundler:error': () => void
  'bundler:done': () => void
  'bundler:progress': (statesArray: any[]) => void

  // @nuxt/generator
  'generate:before': (generator: Generator, generateOptions: NuxtOptions['generate']) => HookResult
  'generate:distRemoved': (generator: Generator) => HookResult
  'generate:distCopied': (generator: Generator) => HookResult
  'generate:route': ({ route, setPayload }: { route: any, setPayload: any }) => HookResult
  'generate:page': (page: {
    route: any,
    path: string,
    html: string,
    exclude: boolean,
    errors: string[]
  }) => HookResult
  'generate:routeCreated': ({ route, path, errors }: { route: any, path: string, errors: any[] }) => HookResult
  'generate:extendRoutes': (routes: any[]) => HookResult
  'generate:routeFailed': ({ route, errors }: { route: any, errors: any[] }) => HookResult
  'generate:manifest': (manifest: any, generator: Generator) => HookResult
  'generate:done': (generator: Generator, errors: any[]) => HookResult

  'export:before': (generator: Generator) => HookResult
  'export:distRemoved': (generator: Generator) => HookResult
  'export:distCopied': (generator: Generator) => HookResult
  'export:route': ({ route, setPayload }: { route: any, setPayload: any }) => HookResult
  'export:routeCreated': ({ route, path, errors }: { route: any, path: string, errors: any[] }) => HookResult
  'export:extendRoutes': ({ routes }: { routes: any[] }) => HookResult
  'export:routeFailed': ({ route, errors }: { route: any, errors: any[] }) => HookResult
  'export:done': (generator: Generator, { errors }: { errors: any[] }) => HookResult

  // vite
  'vite:extend': (viteBuildContext: { nuxt: Nuxt, config: ViteInlineConfig }) => HookResult
  'vite:extendConfig': (viteInlineConfig: ViteInlineConfig, env: { isClient: boolean, isServer: boolean }) => HookResult
  'vite:serverCreated': (viteServer: ViteDevServer, env: { isClient: boolean, isServer: boolean }) => HookResult
}

export type NuxtHookName = keyof NuxtHooks
