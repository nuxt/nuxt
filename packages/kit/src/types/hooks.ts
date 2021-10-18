import type { IncomingMessage, ServerResponse } from 'http'
import type { Compiler, Configuration, Stats } from 'webpack'
import type { TSConfig } from 'pkg-types'
import type { NuxtConfig, NuxtOptions } from '..'
import type { ModuleContainer } from '../module/container'
import type { NuxtTemplate, Nuxt, NuxtApp } from '../types/nuxt'

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

export interface NuxtHooks {
  // nuxt3
  'app:resolve': (app: NuxtApp) => HookResult
  'app:templates': (app: NuxtApp) => HookResult
  'app:templatesGenerated': (app: NuxtApp) => HookResult
  'builder:generateApp': () => HookResult

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

  // @nuxt/nitro
  'nitro:document': (template: { src: string, contents: string }) => HookResult
  'nitro:context': (context: any) => HookResult

  // @nuxt/cli
  'cli:buildError': (error: unknown) => HookResult
  'generate:cache:ignore': (ignore: string[]) => HookResult
  'config': (options: NuxtConfig) => HookResult
  'run:before': (options: { argv: string[], cmd: { name: string, usage: string, description: string, options: Record<string, any> }, rootDir: string }) => HookResult

  // nuxi
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
  'listen': (listenerServer: any, listener: any) => HookResult
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
  'vite:extend': (viteBuildContext: { nuxt: Nuxt, config: any }) => HookResult
  'vite:extendConfig': (viteInlineConfig: any, env: { isClient: boolean, isServer: boolean }) => HookResult
  'vite:serverCreated': (viteServer: any) => HookResult
}

export type NuxtHookName = keyof NuxtHooks
