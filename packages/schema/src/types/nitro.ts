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

export interface ServerHandlerFallback {
  handler: string
  route?: string
  method?: string
  middleware?: boolean
  lazy?: boolean
}

/** @internal */
export type ResolveServerHandler<T> = T extends { handler: infer H } ? H : ServerHandlerFallback

/** A route handler registration, as written into `serverHandlers` by `addServerHandler()`. */
export type ServerHandler = ResolveServerHandler<NitroTypes>

export interface DevServerHandlerFallback {
  route?: string
  handler: unknown
}

/** @internal */
export type ResolveDevServerHandler<T> = T extends { devHandler: infer H } ? H : DevServerHandlerFallback

/** A development-only route handler registration, as written by `addDevServerHandler()`. */
export type DevServerHandler = ResolveDevServerHandler<NitroTypes>

export interface RouteRuleConfigFallback {
  prerender?: boolean
  ssr?: boolean
  noScripts?: boolean
  appMiddleware?: Record<string, boolean>
  payload?: boolean
  redirect?: string | { to: string, status?: number } | false
}

/** @internal */
export type ResolveRouteRuleConfig<T> = T extends { routeRuleConfig: infer R } ? R : RouteRuleConfigFallback

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
 */
export interface NitroConfigFallback {
  virtual?: Record<string, string | (() => string | Promise<string>)>
  plugins?: string[]
  output?: { dir?: string, publicDir?: string, serverDir?: string }
  runtimeConfig?: Record<string, unknown>
  handlers?: ServerHandler[]
  devHandlers?: DevServerHandler[]
  imports?: false | ServerImportsOptions
  scanDirs?: string[]
  routeRules?: Record<string, RouteRuleConfig>
  prerender?: { routes?: string[], crawlLinks?: boolean, ignore?: unknown[], failOnError?: boolean }
  static?: boolean
  typescript?: { tsConfig?: Record<string, any>, generateTsConfig?: boolean, strict?: boolean }
  tracingChannel?: boolean | TracingChannelOptions
  experimental?: { envExpansion?: boolean }
}

/** @internal */
export type ResolveNitroConfig<T> = T extends { config: infer C } ? C : NitroConfigFallback

/** The configuration of the server build, as accepted by the configured `server.builder`. */
export type NitroConfig = ResolveNitroConfig<NitroTypes>

/**
 * Fallback options shape, describing the subset of resolved options common to the supported
 * nitro majors. Used when no server builder has contributed an instance type.
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
