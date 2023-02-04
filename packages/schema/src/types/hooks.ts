import type { TSConfig } from 'pkg-types'
import type { Server as HttpServer } from 'node:http'
import type { Server as HttpsServer } from 'node:https'
import type { InlineConfig as ViteInlineConfig, ViteDevServer } from 'vite'
import type { Manifest } from 'vue-bundle-renderer'
import type { EventHandler } from 'h3'
import type { Import, InlinePreset, Unimport } from 'unimport'
import type { Compiler, Configuration, Stats } from 'webpack'
import type { Nuxt, NuxtApp, ResolvedNuxtTemplate } from './nuxt'
import type { Nitro, NitroConfig } from 'nitropack'
import type { Component, ComponentsOptions } from './components'
import type { NuxtCompatibility, NuxtCompatibilityIssues } from '..'
import type { Schema, SchemaDefinition } from 'untyped'

export type HookResult = Promise<void> | void

// https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html
export type TSReference = { types: string } | { path: string }

export type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'

export type NuxtPage = {
  name?: string
  path: string
  file: string
  meta?: Record<string, any>
  alias?: string[] | string
  redirect?: string
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

export interface ImportPresetWithDeprecation extends InlinePreset {
}

export interface GenerateAppOptions {
  filter?: (template: ResolvedNuxtTemplate<any>) => boolean
}

/**
 * The listeners to Nuxt build time events
 */
export interface NuxtHooks {
  // Kit
  /**
   * Allows extending compatibility checks
   * @param compatibility Compatibility object
   * @param issues Issues to be mapped
   * @returns Promise
   */
  'kit:compatibility': (compatibility: NuxtCompatibility, issues: NuxtCompatibilityIssues) => HookResult

  // Nuxt
  /** 
   * Called after nuxt initialization, when the nuxt instance is ready to work
   * @param nuxt The configured Nuxt object
   * @returns Promise
   */
  'ready': (nuxt: Nuxt) => HookResult
  /**
   * Called when Nuxt instance is gracefully closing.
   * @param nuxt The configured Nuxt object
   * @returns Promise
   */
  'close': (nuxt: Nuxt) => HookResult

  /**
   * Called during nuxt initialization, before install user modules.
   * @returns Promise
   */
  'modules:before': () => HookResult
  /**
   * Called during nuxt initialization, after install user modules
   * @returns Promise
   */
  'modules:done': () => HookResult

  /**
   * Called after resolve `app` instance
   * @param app The resolved `NuxtApp` object
   * @returns Promise
   */
  'app:resolve': (app: NuxtApp) => HookResult
  /**
   * Called during `NuxtApp` generation, after configure user templates
   * @param app The configured `NuxtApp` object
   * @returns Promise
   */
  'app:templates': (app: NuxtApp) => HookResult
  /**
   * Called after templates are compiled into virtual file system (vfs)
   * @param app The configured `NuxtApp` object
   * @returns Promise
   */
  'app:templatesGenerated': (app: NuxtApp) => HookResult

  /**
   * Called before Nuxt bundle builder
   * @returns Promise
   */
  'build:before': () => HookResult
  /**
   * Called after Nuxt bundle builder is complete
   * @returns Promise
   */
  'build:done': () => HookResult
  /**
   * Called during the manifest build by Vite and Webpack
   * @param manifest The manifest object to build
   * @returns Promise
   */
  'build:manifest': (manifest: Manifest) => HookResult

  /**
   * Called before generate app
   * @param options GenerateAppOptions object
   * @returns Promise
   */
  'builder:generateApp': (options?: GenerateAppOptions) => HookResult
  /**
   * Called on build time when option.dev is enabled
   * @param event "add" | "addDir" | "change" | "unlink" | "unlinkDir"
   * @param path the path to the watched file
   * @returns Promise
   */
  'builder:watch': (event: WatchEvent, path: string) => HookResult

  /**
   * Called after pages routes are resolved
   * @param pages Array containing resolved pages
   * @returns Promise
   */
  'pages:extend': (pages: NuxtPage[]) => HookResult

  /**
   * Called when the dev middleware is been registered on server
   * @param handler the Vite or Webpack event handler
   * @returns Promise
   */
  'server:devHandler': (handler: EventHandler) => HookResult

  /**
   * Called at setup allowing modules extending sources
   * @param presets Array containing presets objects
   * @returns Promise
   */
  'imports:sources': (presets: ImportPresetWithDeprecation[]) => HookResult
  /**
   * Called at setup allowing modules extending imports
   * @param imports Array containing the imports to extend
   * @returns Promise
   */
  'imports:extend': (imports: Import[]) => HookResult
  /**
   * Called when the unimport context is created
   * @param context The Unimport context
   * @returns Promise
   */
  'imports:context': (context: Unimport) => HookResult
  /**
   * Allows extending import directories
   * @param dirs Array containing directories as string
   * @returns Promise
   */
  'imports:dirs': (dirs: string[]) => HookResult

  // Components
  /**
   * Called at app:resolve allowing to extend the directories
   * @param dirs The `dirs` option to push new items
   * @returns Promise
   */
  'components:dirs': (dirs: ComponentsOptions['dirs']) => HookResult
  /**
   * Allows extending new components
   * @param components The `components` array to push new items
   * @returns Promise
   */
  'components:extend': (components: Component[]) => HookResult

  // Nitropack
  /**
   * Called at nitro init allowing to extend the configuration
   * @param nitroConfig The nitro config to be extended
   * @returns Promise
   */
  'nitro:config': (nitroConfig: NitroConfig) => HookResult
  /**
   * Called when nitro is exposed at Nuxt instance
   * @param nitro The created nitro object
   * @returns Promise
   */
  'nitro:init': (nitro: Nitro) => HookResult
  /**
   * Called before build the nitro instance
   * @param nitro The created nitro object
   * @returns Promise
   */
  'nitro:build:before': (nitro: Nitro) => HookResult
  /**
   * Allows extending the routes to be prerender
   * @param ctx Nuxt context
   * @returns Promise
   */
  'prerender:routes': (ctx: { routes: Set<string> }) => HookResult

  // Nuxi
  /**
   * Called when an error occurs at build time
   * @param error Error object
   * @returns Promise
   */
  'build:error': (error: Error) => HookResult
  /**
   * Called when nuxi is writing types
   * @param options Objects containing `references`, `declarations`, `tsConfig`
   * @returns Promise
   */
  'prepare:types': (options: { references: TSReference[], declarations: string[], tsConfig: TSConfig }) => HookResult
  /**
   * Called when the dev server is loading
   * @param listenerServer The HTTP/HTTPS server object
   * @param listener The server's listener object
   * @returns Promise
   */
  'listen': (listenerServer: HttpServer | HttpsServer, listener: any) => HookResult

  // Schema
  /**
   * Allows to extend default schemas
   * @param schemas Schemas to be extend
   * @returns void
   */
  'schema:extend': (schemas: SchemaDefinition[]) => void
  /**
   * Allows to extend resolved schema
   * @param schema Schema object
   * @returns void
   */
  'schema:resolved': (schema: Schema) => void
  /**
   * Called before write the given schema
   * @param schema Schema object
   * @returns void
   */
  'schema:beforeWrite': (schema: Schema) => void
  /**
   * Called after the schema is written
   * @returns void
   */
  'schema:written': () => void

  // Vite
  /**
   * Allows to extend Vite default context
   * @param viteBuildContext The vite build context object
   * @returns Promise
   */
  'vite:extend': (viteBuildContext: { nuxt: Nuxt, config: ViteInlineConfig }) => HookResult
  /**
   * Allows to extend Vite default config
   * @param viteInlineConfig The vite inline config object
   * @param env Server or client
   * @returns Promise
   */
  'vite:extendConfig': (viteInlineConfig: ViteInlineConfig, env: { isClient: boolean, isServer: boolean }) => HookResult
  /**
   * Called when the vite server is created
   * @param viteServer Vite development server
   * @param env Server or client
   * @returns Promise
   */
  'vite:serverCreated': (viteServer: ViteDevServer, env: { isClient: boolean, isServer: boolean }) => HookResult
  /**
   * Called on server and on the client, right after vite is compiled
   * @returns Promise
   */
  'vite:compiled': () => HookResult

  // webpack
  /**
   * Called before configure the webpack compiler
   * @param webpackConfigs Configs objects to be pushed to the compiler
   * @returns Promise
   */
  'webpack:config': (webpackConfigs: Configuration[]) => HookResult
  /**
   * Called right before compilation
   * @param options The options to be added
   * @returns Promise
   */
  'webpack:compile': (options: { name: string, compiler: Compiler }) => HookResult
  /**
   * Called after resources are loaded
   * @param options The compiler options
   * @returns Promise
   */
  'webpack:compiled': (options: { name: string, compiler: Compiler, stats: Stats }) => HookResult

  /**
   * Called on `change` on WebpackBar
   * @param shortPath the short path
   * @returns void
   */
  'webpack:change': (shortPath: string) => void
  /**
   * Called on `done` if has errors on WebpackBar
   * @returns void
   */
  'webpack:error': () => void
  /**
   * Called on `allDone` on WebpackBar
   * @returns void
   */
  'webpack:done': () => void
  /**
   * Called on `progress` on WebpackBar
   * @param statesArray The array containing the states on progress
   * @returns void
   */
  'webpack:progress': (statesArray: any[]) => void
}

export type NuxtHookName = keyof NuxtHooks
