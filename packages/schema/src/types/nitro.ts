import type { NuxtImport } from './imports.ts'

/**
 * Extension point through which the configured `server.builder` contributes the types of the
 * server it builds: the instance it constructs, and the configuration it accepts.
 *
 * Nitro is not a dependency of `@nuxt/schema` and which major is installed is the builder's
 * decision, so these are declared where they are built rather than imported here.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NitroTypes {}

/** Auto-imports injected into the server program, as written by `addServerImports()`. */
export interface ServerImportsOptions {
  autoImport?: boolean
  dirs?: string[]
  imports?: NuxtImport[]
  presets?: Array<{ from: string, imports: Array<string | { name: string, as?: string }>, typeFrom?: string }>
  exclude?: Array<string | RegExp>
}

/** A handler entry in a server builder's own configuration, when it contributes no types. */
export interface ServerHandlerFallback {
  handler: string
  route?: string
  method?: string
  middleware?: boolean
  lazy?: boolean
}

/** A development-only handler entry in a server builder's own configuration. */
export interface DevServerHandlerFallback {
  route?: string
  handler: unknown
}

/**
 * The server API a piece of server code is written against.
 *
 * - `nitro2`: nitropack v2 and h3 v1 (`h3`, `nitropack/runtime`, `#imports`). Runs on a
 *   Nitro v3 host through the compatibility layer.
 * - `nitro3`: Nitro v3 and h3 v2 (`nitro`, `nitro/h3`). Pinned to the Nitro server builder.
 * - `nuxt`: only `nuxt/server`. Runs under any server builder.
 *
 * A closed set today; a server builder may contribute further values later.
 */
export type ServerApi = 'nitro2' | 'nitro3' | 'nuxt'

/**
 * One implementation, or one per server API for code mid-migration. Only the one the host
 * prefers is registered.
 */
export type ServerApiVariants<T, Api extends ServerApi = ServerApi> = T | Partial<Record<Api, T>>

export type ServerHandlerMethod = 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'QUERY'

/** Environments a handler is bundled for. */
export type ServerHandlerEnv = 'dev' | 'prod' | 'prerender' | (string & {})

export interface ServerRouteMeta {
  openAPI?: Record<string, any>
}

/**
 * What a route handler registration says about itself, apart from where its implementation
 * lives. The configured `server.builder` normalises it into whatever its own runtime
 * accepts; reach for `nuxt.options.nitro.handlers` to write an entry typed by Nitro itself.
 */
export interface ServerHandlerBase {
  /**
   * HTTP pathname pattern to match. A handler registered without one is middleware that
   * runs on every route.
   *
   * @example "/test", "/api/:id", "/blog/**"
   */
  route?: string
  /**
   * HTTP method to match. `QUERY` requires a server runtime that implements it, and the
   * registration is skipped on one that does not.
   */
  method?: ServerHandlerMethod | Lowercase<ServerHandlerMethod>
  /** Run the handler as middleware, before other route handlers. */
  middleware?: boolean
  /** Import the handler lazily, on first use. */
  lazy?: boolean
  /** Route metadata (e.g. OpenAPI operation info). */
  meta?: ServerRouteMeta
  /** Environments to include and bundle this handler for. */
  env?: ServerHandlerEnv | ServerHandlerEnv[]
  /**
   * Handler module format. Requires a server runtime that converts node handlers, and is
   * dropped on one that does not.
   */
  format?: 'web' | 'node'
}

/** A route handler registration, as written into `serverHandlers`. */
export interface ServerHandler extends ServerHandlerBase {
  /** Path to the handler. */
  handler: string
}

/**
 * A route handler registration as `addServerHandler()` accepts it. Only the variant the
 * host runs reaches `serverHandlers`.
 */
export interface ServerHandlerInput extends ServerHandlerBase {
  /** Path to the handler, or one path per server API. */
  handler: ServerApiVariants<string>
}

/** A development-only handler: a function taking the request event, or a fetchable object. */
export type DevServerHandlerFunction = ((...args: any[]) => any) | { fetch: (...args: any[]) => any } | Record<string, any>

/** What a development-only handler registration says about itself. */
export interface DevServerHandlerBase {
  /** HTTP pathname pattern to match. */
  route?: string
  /** HTTP method to match. */
  method?: ServerHandlerMethod | Lowercase<ServerHandlerMethod>
  /** Run the handler as middleware, before other route handlers. */
  middleware?: boolean
  /** Route metadata (e.g. OpenAPI operation info). */
  meta?: ServerRouteMeta
}

/** A development-only route handler registration, as written into `devServerHandlers`. */
export interface DevServerHandler extends DevServerHandlerBase {
  handler: DevServerHandlerFunction
}

/** A development-only registration as `addDevServerHandler()` accepts it. */
export interface DevServerHandlerInput extends DevServerHandlerBase {
  /** The handler, or one per server API. */
  handler: ServerApiVariants<DevServerHandlerFunction>
}

/**
 * A plugin as `addNitroPlugin()` accepts it. There is no portable variant: `nuxt/server`
 * has no plugin surface, so a startup plugin is written against a nitro major.
 */
export type ServerPluginInput = ServerApiVariants<string, Exclude<ServerApi, 'nuxt'>>

/** A resolved server plugin registration, as written into `_serverPlugins`. */
export interface ServerPlugin {
  /** Path to the plugin the host runs. */
  plugin: string
  /** The server API it was registered for, when the module named one. */
  compatibility?: ServerApi
  /** Paths of the variants the host does not run. */
  unused?: string[]
}

export interface RouteRuleConfigFallback extends RouteRuleConfigExtensions {
  prerender?: boolean
  ssr?: boolean
  noScripts?: boolean
  payload?: boolean
  redirect?: string | { to: string, status?: number } | false
  isr?: number | boolean | Record<string, any>
  cache?: false | Record<string, any>
}

/** @internal */
export type ResolveRouteRuleConfig<T> = T extends { routeRuleConfig: infer R } ? R : RouteRuleConfigFallback

/**
 * Extension point for rules that may be configured for a route pattern but are not known
 * statically, such as `appLayout` and `appMiddleware`, whose values Nuxt generates from the
 * layouts and middleware it has scanned.
 *
 * A server builder that resolves rules with its own types bridges these into them, so that a
 * rule is configurable whichever type describes the configuration.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouteRuleConfigExtensions {}

/**
 * The rules that may be configured for a route pattern. `AppRouteRules` describes the same
 * rules as the app layer reads them, once matched and normalised.
 */
export type RouteRuleConfig = ResolveRouteRuleConfig<NitroTypes>

/** The tracing channels Nuxt owns, enabled independently of the server runtime's own. */
export interface TracingChannelOptionsBase {
  /** Enable Nuxt-owned channels (`nuxt.render`, `nuxt.island`, `nuxt.data`, `nuxt.plugin`). */
  nuxt?: boolean
}

/** @internal */
export type ResolveTracingChannelOptions<T> = TracingChannelOptionsBase & (T extends { tracingChannels: infer C } ? C : Record<string, boolean | undefined>)

/**
 * Per-channel toggles for `tracingChannel`. Channel names follow the
 * [untracing](https://github.com/unjs/untracing) naming convention (`{namespace}.{operation}`).
 *
 * @experimental Channel names, payload shapes, and option keys may change.
 */
export type TracingChannelOptions = ResolveTracingChannelOptions<NitroTypes>

/**
 * Fallback configuration shape, limited to the keys Nuxt itself reads and writes. A server
 * builder typically accepts a far wider set, which it describes itself.
 *
 * Members must be registry-independent: a member typed through a {@link NitroTypes} or
 * `ServerTypes` key stops describing the fallback as soon as a builder's augments are in the
 * program.
 */
export interface NitroConfigFallback {
  virtual?: Record<string, string | (() => string | Promise<string>)>
  plugins?: string[]
  output?: { dir?: string, publicDir?: string, serverDir?: string }
  runtimeConfig?: Record<string, unknown>
  handlers?: ServerHandlerFallback[]
  devHandlers?: DevServerHandlerFallback[]
  imports?: false | ServerImportsOptions
  scanDirs?: string[]
  routeRules?: Record<string, RouteRuleConfigFallback>
  prerender?: { routes?: string[], crawlLinks?: boolean, ignore?: unknown[], failOnError?: boolean }
  static?: boolean
  typescript?: { tsConfig?: Record<string, any>, generateTsConfig?: boolean, strict?: boolean }
  tracingChannel?: boolean | (TracingChannelOptionsBase & Record<string, boolean | undefined>)
  experimental?: { envExpansion?: boolean }
}

/** @internal */
export type ResolveNitroConfig<T> = T extends { config: infer C } ? C : NitroConfigFallback

/** The configuration of the server build, as accepted by the configured `server.builder`. */
export type NitroConfig = ResolveNitroConfig<NitroTypes>

/**
 * Fallback options shape, describing the subset of resolved options common to the supported
 * nitro majors. Used when no server builder has contributed an instance type.
 *
 * Members must be registry-independent, as on {@link NitroConfigFallback}.
 */
export interface NitroInstanceOptionsFallback {
  handlers: ServerHandlerFallback[]
  devHandlers: DevServerHandlerFallback[]
  runtimeConfig: Record<string, any>
  plugins: string[]
  alias: Record<string, string>
  virtual: Record<string, any>
  publicAssets: Array<{ dir: string, baseURL?: string } & Record<string, any>>
  routeRules: Record<string, Record<string, any>>
  prerender: Record<string, any>
  output: Record<string, any>
  storage?: Record<string, any>
  devStorage?: Record<string, any>
  static?: boolean
  node?: boolean
  baseURL?: string
  preset?: string
  dev: boolean
  typescript?: NitroConfigFallback['typescript']
  _config?: Record<string, any>
  rollupConfig?: Record<string, any>
  ssrRoutes?: string[]
}

/**
 * Fallback instance shape, describing the subset of the nitro instance common to the
 * supported nitro majors. Used when no server builder has contributed an instance type.
 *
 * Members must be registry-independent, as on {@link NitroConfigFallback}.
 */
export interface NitroInstanceFallback {
  meta: {
    version: string
    majorVersion: number
  }
  options: NitroInstanceOptionsFallback
  scannedHandlers: Array<Record<string, any>>
  vfs: Record<string, string> | Map<string, { render: () => string | Promise<string> }>
  hooks: {
    hook: (...args: any[]) => () => void
    hookOnce: (...args: any[]) => () => void
    callHook: (...args: any[]) => void | Promise<any>
    addHooks: (...args: any[]) => () => void
    removeHook: (...args: any[]) => void
  }
  logger: {
    log: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
  } & Record<string, any>
  /** Only available on nitro v3. */
  fetch?: (input: Request) => Response | Promise<Response>
  /** Only available on nitro v3. */
  routing?: {
    sync: () => void
    routeRules: { routes: Array<{ route: string, data: Record<string, any> }> } & Record<string, any>
  } & Record<string, any>
  /** Only available on nitro v2. */
  storage?: unknown
  unimport?: unknown
  updateConfig: (config: Record<string, any>) => void | Promise<void>
  close: () => Promise<void>
}

/**
 * Resolves the instance type contributed to a {@link NitroTypes} registry, or {@link NitroInstanceFallback}
 * when the registry does not declare one. Exported for type tests; not part of the public API.
 *
 * @internal
 */
export type ResolveNitroInstance<T> = T extends { instance: infer I } ? I : NitroInstanceFallback

/**
 * Resolves the options of a nitro instance type, or {@link NitroInstanceOptionsFallback} when the instance
 * does not declare them. Exported for type tests; not part of the public API.
 *
 * @internal
 */
export type ResolveNitroInstanceOptions<T> = T extends { options: infer O } ? O : NitroInstanceOptionsFallback

/**
 * The nitro instance handed out by `useNitro()`, as declared by the configured
 * `server.builder`, or {@link NitroInstanceFallback} when none has declared it.
 *
 * Registrations accepted by `@nuxt/kit`'s nitro utilities are described by that package; this is
 * only the running instance, whose type is the server builder's to declare.
 */
export type NitroInstance = ResolveNitroInstance<NitroTypes>

/** The resolved options of the nitro instance handed out by `useNitro()`. */
export type NitroInstanceOptions = ResolveNitroInstanceOptions<NitroInstance>
