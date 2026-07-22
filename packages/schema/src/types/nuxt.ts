import type { AsyncLocalStorage } from 'node:async_hooks'
import type { Hookable } from 'hookable'
import type { Ignore } from 'ignore'
import type { NuxtModule } from './module.ts'
import type { NuxtHooks, NuxtLayout, NuxtMiddleware, NuxtPage } from './hooks.ts'
import type { Component } from './components.ts'
import type { NuxtOptions } from './config.ts'
import type { NuxtDebugContext } from './debug.ts'

export interface NuxtPlugin {
  /** @deprecated use mode */
  ssr?: boolean
  src: string
  mode?: 'all' | 'server' | 'client'
  /**
   * This allows more granular control over plugin order and should only be used by advanced users.
   * Lower numbers run first, and user plugins default to `0`.
   *
   * Default Nuxt priorities can be seen at [here](https://github.com/nuxt/nuxt/blob/9904849bc87c53dfbd3ea3528140a5684c63c8d8/packages/nuxt/src/core/plugins/plugin-metadata.ts#L15-L34).
   */
  order?: number
  /**
   * @internal
   */
  name?: string
}

// Internal type for simpler NuxtTemplate interface extension

type TemplateDefaultOptions = Record<string, any>

export interface NuxtTemplate<Options = TemplateDefaultOptions> {
  /** resolved output file path (generated) */
  dst?: string
  /** The target filename once the template is copied into the Nuxt buildDir */
  filename?: string
  /** An options object that will be accessible within the template via `<% options %>` */
  options?: Options
  /** The resolved path to the source file to be template */
  src?: string
  /** Provided compile option instead of src */

  getContents?: (data: { nuxt: Nuxt, app: NuxtApp, options: Options }) => string | Promise<string>
  /** Write to filesystem */
  write?: boolean
  /**
   * The source path of the template (to try resolving dependencies from).
   * @internal
   */
  _path?: string
}

export interface NuxtServerTemplate {
  /** The target filename once the template is copied into the Nuxt buildDir */
  filename: string
  getContents: () => string | Promise<string>
}

export interface ResolvedNuxtTemplate<Options = TemplateDefaultOptions> extends NuxtTemplate<Options> {
  filename: string
  dst: string
  modified?: boolean
}

export interface NuxtTypeTemplate<Options = TemplateDefaultOptions> extends Omit<NuxtTemplate<Options>, 'write' | 'filename'> {
  filename: `${string}.d.ts`
  write?: true
}

type _TemplatePlugin<Options> = Omit<NuxtPlugin, 'src'> & NuxtTemplate<Options>
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NuxtPluginTemplate<Options = TemplateDefaultOptions> extends _TemplatePlugin<Options> { }

export interface NuxtApp {
  mainComponent?: string | null
  rootComponent?: string | null
  errorComponent?: string | null
  dir: string
  extensions: string[]
  plugins: NuxtPlugin[]
  components: Component[]
  layouts: Record<string, NuxtLayout>
  middleware: NuxtMiddleware[]
  templates: NuxtTemplate[]
  configs: string[]
  pages?: NuxtPage[]
}

/**
 * Build artifacts consumed by the Nitro server runtime via `nuxt/*` subpath imports.
 *
 * Builders populate this with the `setBuildOutput()` kit helper. Each key is a
 * (possibly async) function returning the module body as a string.
 */
export interface NuxtBuildOutputs {
  /** Module body re-exporting the SSR app entry. */
  serverEntry: () => string | Promise<string>
  /**
   * Module body for the per-component SSR styles map. Defaults to
   * `export default {}` when the build produces no inline styles.
   */
  ssrStyles: () => string | Promise<string>
  /** Serialized client manifest for `vue-bundle-renderer`. */
  clientManifest: () => string | Promise<string>
  /** Serialized precomputed client dependency data for `vue-bundle-renderer`. */
  clientPrecomputed: () => string | Promise<string>
  /** Module body exporting the hashed entry chunk filename for import maps. */
  entryChunkName: () => string | Promise<string>
  /** Module body exporting the entry module IDs used for inline style extraction. */
  entryIds: () => string | Promise<string>
}

export interface Nuxt {
  // Private fields.
  '__name': string
  '_version': string
  '_ignore'?: Ignore
  '_dependencies'?: Set<string>
  '~runtimeDependencies'?: string[]
  '_debug'?: NuxtDebugContext
  /**
   * Performance profiler instance, available when `debug.perf` is enabled.
   * @internal
   */
  '_perf'?: {
    startPhase: (name: string) => void
    endPhase: (name?: string) => void
    collectModuleTimings: (modules: Array<{ meta?: { name?: string }, timings?: Record<string, number | undefined> }>) => void
    recordBundlerPluginHook: (pluginName: string, hookName: string, durationMs: number, startTime?: number) => void
    printReport: (options?: { title?: string }) => void
    writeReport: (buildDir: string, options?: { quiet?: boolean }) => string
    dispose: () => void
  }
  /** Async local storage for current running Nuxt module instance. */
  '_asyncLocalStorageModule'?: AsyncLocalStorage<NuxtModule>

  /**
   * The Node HTTP(S) server the dev server is listening on, captured from the
   * `listen` hook. Builders use it to attach their HMR websocket to the same
   * server (and therefore the same port and certificate) as the app.
   * @internal
   */
  '_devServerListener'?: import('node:http').Server | import('node:https').Server
  /**
   * Module options functions collected from moduleDependencies.
   * @internal
   */
  '_moduleOptionsFunctions'?: Map<string | NuxtModule, Array<() => { defaults?: Record<string, unknown>, overrides?: Record<string, unknown> }>>

  /** The resolved Nuxt configuration. */
  'options': NuxtOptions
  'hooks': Hookable<NuxtHooks>
  'hook': Nuxt['hooks']['hook']
  'callHook': Nuxt['hooks']['callHook']
  'addHooks': Nuxt['hooks']['addHooks']
  'runWithContext': <T extends (...args: any[]) => any>(fn: T) => ReturnType<T>

  'ready': () => Promise<void>
  'close': () => Promise<void>

  /** The production or development server. */
  'server'?: any

  'vfs': Record<string, string>

  'apps': Record<string, NuxtApp>

  'buildOutputs': NuxtBuildOutputs
}
