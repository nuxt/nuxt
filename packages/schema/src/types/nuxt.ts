import type { AsyncLocalStorage } from 'node:async_hooks'
import type { NuxtHookRegistry } from './hookable.ts'
import type { NuxtIgnoreMatcher } from './ignore.ts'
import type { NuxtModule } from './module.ts'
import type { NuxtHooks, NuxtLayout, NuxtMiddleware, NuxtPage, WatchEvent } from './hooks.ts'
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

/**
 * A well-known input a template can declare it depends on:
 *
 * - `'pages'`: the contents of the files backing `app.pages`
 * - `'plugins'`: the contents of the files listed in `app.plugins`
 */
export type NuxtTemplateDependency = 'pages' | 'plugins'

/** A watched file event that may require regenerating templates. */
export interface NuxtTemplateChange {
  event: WatchEvent
  /** absolute path of the file the event was emitted for */
  path: string
}

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
   * The watched inputs the output of this template can depend on, beyond `nuxt.options` and the
   * resolved structure of the app (which files exist, and where).
   *
   * Set this to `[]` if the template never reads the contents of a watched file. In dev mode
   * Nuxt then skips recompiling it when a file changes without any file being added or removed.
   * List well-known keys (such as `'pages'` or `'plugins'`) if the template reads those sources,
   * or pass a function to decide per change.
   *
   * A template that declares nothing is regenerated on every change, unless it has a `src`, in
   * which case it is regenerated only when that source file changes.
   */
  dependsOn?: NuxtTemplateDependency[] | ((change: NuxtTemplateChange, ctx: { nuxt: Nuxt, app: NuxtApp, options: Options }) => boolean)
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
   * Module body for the per-component SSR styles map, plus an `inlinedCSS`
   * named export mapping each emitted CSS file whose `<link>` may be dropped at
   * render time to the groups of module IDs that inline its contents. Defaults
   * to an empty map for both.
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

/**
 * Where the configured server builder writes its output.
 *
 * Every path is a function rather than a string because a builder may only know its
 * paths once it has initialised: Nitro's output directory depends on the resolved
 * preset, and can still move afterwards. Call these from a hook that runs after `ready`.
 *
 * @internal
 */
export interface NuxtServerBuildOutput {
  /** Absolute path to the build output directory, without a trailing slash. */
  dir: () => string
  /**
   * Absolute path to the directory of deployable static assets within the output,
   * without a trailing slash.
   */
  publicDir: () => string
}

/**
 * What a server builder can do, so consumers need not infer it from its name.
 *
 * @internal
 */
export interface NuxtServerBuildCapabilities {
  /** Whether the build produces a server runtime. `false` for a static-only build. */
  server: boolean
  /** Whether the builder provides a dev server on `nuxt.server`. */
  dev: boolean
}

/**
 * Module specifiers the server build resolves its runtime from. A server builder that is
 * not backed by Nitro points these at its own implementations.
 *
 * @internal
 */
export interface NuxtServerBuildRuntime {
  /** Exports `fetch`, used to back `$fetch` on the server. */
  fetch: string
  /** Exports `useRuntimeConfig`. */
  runtimeConfig: string
}

/**
 * How to preview the build output locally.
 *
 * @internal
 */
export interface NuxtServerBuildPreview {
  /** Shell command that starts the built server, when there is one to start. */
  command?: () => string | undefined
  /** Directory to serve statically when there is no server to start. */
  staticDir?: () => string
}

/**
 * A description of the build the configured `server.builder` produces, for consumers
 * (the Nuxt CLI, deployment tooling) that need to know what was built and where without
 * reaching for a Nitro instance.
 *
 * **Experimental and not public API.** The shape is exported from `@nuxt/schema/internal`
 * and read and written with the `useServerBuild()` / `setServerBuild()` helpers from
 * `@nuxt/kit/internal`, and will change without a major release while the second server
 * builder (`@nuxt/vite-server`) is being built out.
 *
 * @internal
 */
export interface NuxtServerBuild {
  /**
   * Stable identifier for the builder implementation, such as `nitro` or `vite`.
   * Defaults to the configured `server.builder` specifier.
   */
  name: string
  /** Human-readable name of the builder, for CLI output. Defaults to `name`. */
  label?: string
  /**
   * Deploy target within the builder: a Nitro preset, or a Vite deploy target. Read on
   * access, as a builder may resolve it during its own initialisation.
   */
  target?: () => string | undefined
  /** What to call the `target` axis when printing it, such as `preset`. */
  targetLabel?: string
  output: NuxtServerBuildOutput
  capabilities: NuxtServerBuildCapabilities
  runtime: NuxtServerBuildRuntime
  preview?: NuxtServerBuildPreview
}

export interface Nuxt {
  // Private fields.
  '__name': string
  '_version': string
  '_ignore'?: NuxtIgnoreMatcher
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
   * Nitro majors recorded for server plugins registered via `addServerPlugin`,
   * keyed by normalized specifier, resolved file path and alias-resolved path.
   * Absent entries are nitro v2.
   * @internal
   */
  '_serverPluginVersions'?: Map<string, 2 | 3>
  /**
   * Nitro majors recorded for server auto-import sources, scanned directories and
   * server template ids. Absent entries are nitro v2.
   * @internal
   */
  '_serverImportVersions'?: Map<string, 2 | 3>
  /**
   * Server registrations kit skipped because they target a newer nitro major than
   * the host provides. Recorded for devtools and tests.
   * @internal
   */
  '_skippedNitroRegistrations'?: Array<{ api: string, version: number, host: number | undefined }>

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
  'hooks': NuxtHookRegistry<NuxtHooks>
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

  /**
   * A description of the build the configured server builder produces.
   *
   * @internal
   */
  'serverBuild': NuxtServerBuild
}
