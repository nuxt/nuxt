import type { TSConfig } from 'pkg-types'
import type { Server as HttpServer } from 'node:http'
import type { Server as HttpsServer } from 'node:https'
import type { InlineConfig as ViteInlineConfig, ViteDevServer } from 'vite'
import type { Manifest } from 'vue-bundle-renderer'
import type { EventHandler } from 'h3'
import type { Import, InlinePreset } from 'unimport'
import type { Compiler, Configuration, Stats } from 'webpack'
import type { Nuxt, NuxtApp, ResolvedNuxtTemplate } from './nuxt'
import type { Nitro, NitroConfig } from 'nitropack'
import type { Component, ComponentsOptions } from './components'
import { NuxtCompatibility, NuxtCompatibilityIssues } from '..'

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
  /**
   * @deprecated renamed to `imports`
   */
  names?: string[]
}

export interface GenerateAppOptions {
  filter?: (template: ResolvedNuxtTemplate<any>) => boolean
}

export interface NuxtHooks {
  // Kit
  'kit:compatibility': (compatibility: NuxtCompatibility, issues: NuxtCompatibilityIssues) => HookResult

  // Nuxt
  'ready': (nuxt: Nuxt) => HookResult
  'close': (nuxt: Nuxt) => HookResult

  'modules:before': () => HookResult
  'modules:done': () => HookResult

  'app:resolve': (app: NuxtApp) => HookResult
  'app:templates': (app: NuxtApp) => HookResult
  'app:templatesGenerated': (app: NuxtApp) => HookResult

  'build:before': () => HookResult
  'build:done': () => HookResult
  'build:manifest': (manifest: Manifest) => HookResult

  'builder:generateApp': (options?: GenerateAppOptions) => HookResult
  'builder:watch': (event: WatchEvent, path: string) => HookResult

  'pages:extend': (pages: NuxtPage[]) => HookResult

  'server:devHandler': (handler: EventHandler) => HookResult

  // Auto imports
  /** @deprecated Please use `imports:sources` hook */
  'autoImports:sources': (presets: ImportPresetWithDeprecation[]) => HookResult
  /** @deprecated Please use `imports:extend` hook */
  'autoImports:extend': (imports: Import[]) => HookResult
  /** @deprecated Please use `imports:dirs` hook */
  'autoImports:dirs': (dirs: string[]) => HookResult

  'imports:sources': (presets: ImportPresetWithDeprecation[]) => HookResult
  'imports:extend': (imports: Import[]) => HookResult
  'imports:dirs': (dirs: string[]) => HookResult

  // Components
  'components:dirs': (dirs: ComponentsOptions['dirs']) => HookResult
  'components:extend': (components: Component[]) => HookResult

  // Nitropack
  'nitro:config': (nitroConfig: NitroConfig) => HookResult
  'nitro:init': (nitro: Nitro) => HookResult
  'nitro:build:before': (nitro: Nitro) => HookResult

  // Nuxi
  'build:error': (error: Error) => HookResult
  'prepare:types': (options: { references: TSReference[], declarations: string[], tsConfig: TSConfig }) => HookResult
  'listen': (listenerServer: HttpServer | HttpsServer, listener: any) => HookResult

  // Vite
  'vite:extend': (viteBuildContext: { nuxt: Nuxt, config: ViteInlineConfig }) => HookResult
  'vite:extendConfig': (viteInlineConfig: ViteInlineConfig, env: { isClient: boolean, isServer: boolean }) => HookResult
  'vite:serverCreated': (viteServer: ViteDevServer, env: { isClient: boolean, isServer: boolean }) => HookResult
  'vite:compiled': () => HookResult

  // Webpack
  'webpack:config': (webpackConfigs: Configuration[]) => HookResult
  'webpack:compile': (options: { name: string, compiler: Compiler }) => HookResult
  'webpack:compiled': (options: { name: string, compiler: Compiler, stats: Stats }) => HookResult

  'webpack:change': (shortPath: string) => void
  'webpack:error': () => void
  'webpack:done': () => void
  'webpack:progress': (statesArray: any[]) => void
}

export type NuxtHookName = keyof NuxtHooks
