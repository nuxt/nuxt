/**
 * The type of a running nitro instance, resolved from the configured `server.builder`.
 *
 * Nitro is not a dependency of `@nuxt/schema`, and which major is installed is the server
 * builder's decision, so the instance is declared as an extension point that the builder fills
 * in rather than imported here.
 */

/**
 * Extension point through which the configured `server.builder` contributes the types of
 * the nitro instance it constructs.
 *
 * `@nuxt/nitro-server` declares `instance` here, typed against the nitro major it installs,
 * and Nuxt references its declarations from the generated `.nuxt` types. Declaring the
 * instance where it is built keeps the resolved shape accurate across nitro majors without
 * `@nuxt/schema` depending on either of them.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NitroTypes {}

/**
 * Fallback options shape, describing the subset of resolved options common to the supported
 * nitro majors. Used when no server builder has contributed an instance type.
 */
export interface NitroInstanceOptionsFallback {
  handlers: Array<Record<string, any>>
  devHandlers: Array<Record<string, any>>
  runtimeConfig: Record<string, any>
  plugins: string[]
  alias: Record<string, string>
  virtual: Record<string, any>
  publicAssets: Array<Record<string, any>>
  prerender: Record<string, any>
  output: Record<string, any>
  storage?: Record<string, any>
  devStorage?: Record<string, any>
  static?: boolean
  node?: boolean
  baseURL?: string
  preset?: string
  dev: boolean
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
    routeRules: { routes: Array<{ route: string, data: Record<string, any> }> }
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
