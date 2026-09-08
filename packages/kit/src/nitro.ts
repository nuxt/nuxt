import { normalize } from 'pathe'
import type { DevServerHandlerInput, NitroInstance, Nuxt, NuxtImport, ServerApi, ServerApiVariants, ServerHandler, ServerHandlerInput, ServerPlugin, ServerPluginInput } from '@nuxt/schema'

import { tryUseNuxt, useNuxt } from './context.ts'
import { getNitroVersion } from './compatibility.ts'
import { toArray } from './utils.ts'
import { kitDiagnostics } from './diagnostics/kit-api.ts'

const SERVER_APIS = new Set<ServerApi>(['nitro2', 'nitro3', 'nuxt'])
// `nuxt/server` has no plugin surface, so a startup plugin is written against a nitro major
const NITRO_APIS = new Set<ServerApi>(['nitro2', 'nitro3'])
// `server.builder` may be a package name or a path to one
const NITRO_SERVER_BUILDER_RE = /(?:^|[\\/])(?:@nuxt\/)?nitro-server(?:$|[\\/.])/

/**
 * The server APIs the configured `server.builder` runs, most preferred first, or
 * `undefined` when nothing identifies it. Hardcoded per builder for now.
 * @internal
 */
export function getHostServerApis (nuxt: Nuxt = useNuxt()): ServerApi[] | undefined {
  const builder = (nuxt.options as { server?: { builder?: unknown } }).server?.builder
  if (builder !== undefined && !(typeof builder === 'string' && NITRO_SERVER_BUILDER_RE.test(builder))) {
    return ['nuxt']
  }
  switch (getNitroVersion(nuxt)) {
    case 3: return ['nitro3', 'nuxt', 'nitro2']
    case 2: return ['nitro2', 'nuxt']
    default: return undefined
  }
}

/** An unidentifiable host is, in practice, an older Nuxt on nitro v2. */
const UNIDENTIFIED_HOST_APIS: ServerApi[] = ['nitro2', 'nuxt', 'nitro3']

/**
 * The server API a registration was resolved for, and the variants the host does not run.
 *
 * Symbol-keyed and non-enumerable, so that an entry is exactly what a server builder
 * expects to find in `serverHandlers`, including one that hands it straight to nitro.
 * @internal
 */
export const kServerApi = Symbol.for('nuxt.serverApi')
/** @internal */
export const kUnusedVariants = Symbol.for('nuxt.serverApiUnused')

interface ResolvedVariant<T> {
  value: T
  api?: ServerApi
  unused: T[]
}

/**
 * The variant of a registration this host runs, or `undefined` when it runs none of them.
 *
 * Resolved here rather than by the server builder, because kit is installed against hosts
 * whose builder knows nothing about variants.
 */
function resolveVariant<T, Api extends ServerApi> (api: string, variants: ServerApiVariants<T, Api>, normalizeValue: (value: T) => T, accepted: Set<ServerApi>): ResolvedVariant<T> | undefined {
  const host = (getHostServerApis() ?? UNIDENTIFIED_HOST_APIS).filter(candidate => accepted.has(candidate))

  if (host.length === 0) {
    kitDiagnostics.NUXT_B8024({ api, declared: '', host: (getHostServerApis() ?? []).join('`, `') })
    return
  }

  if (variants === null || typeof variants !== 'object') {
    return { value: normalizeValue(variants as T), unused: [] }
  }

  const declared = new Map<ServerApi, T>()
  for (const key in variants) {
    if (!accepted.has(key as ServerApi)) {
      throw kitDiagnostics.NUXT_B8025({ api, value: key, accepted: [...accepted].join('`, `') })
    }
    declared.set(key as ServerApi, normalizeValue((variants as Record<string, T>)[key]!))
  }

  const picked = host.find(candidate => declared.has(candidate))
  if (picked === undefined) {
    kitDiagnostics.NUXT_B8024({ api, declared: [...declared.keys()].join('`, `'), host: host.join('`, `') })
    return
  }

  const value = declared.get(picked)!
  declared.delete(picked)
  return { value, api: picked, unused: [...declared.values()] }
}

function withVariantMeta<T extends object, V> (entry: T, resolved: ResolvedVariant<V>): T {
  if (resolved.api !== undefined) {
    Object.defineProperty(entry, kServerApi, { value: resolved.api, configurable: true })
  }
  if (resolved.unused.length > 0) {
    Object.defineProperty(entry, kUnusedVariants, { value: resolved.unused, configurable: true })
  }
  return entry
}

const HANDLER_METHOD_RE = /\.(get|head|patch|post|put|delete|connect|options|trace|query)(\.\w+)*$/
const WILDCARD_SUFFIX_RE = /\/\*\*(?::\w+)?$/

/**
 * h3 v1 routes with radix3, where `/fonts/**` matches every path below `/fonts` but not
 * `/fonts` itself; h3 v2 routes with rou3, where it matches both. A second registration on
 * the base path gives one wildcard route the same reach on either, and rou3 prefers the
 * static route, so the pair is unambiguous where both are registered.
 *
 * A handler already registered on the base path for the same method keeps it: a
 * method-specific handler there does not answer the other methods the wildcard covers.
 *
 * Not applied to middleware, which nitro v2 mounts with `app.use()` and so already runs on
 * the base path, nor to `/**`, whose base would shadow the renderer on `/`.
 */
function addLegacyBaseRoute (nuxt: Nuxt, entry: ServerHandler, resolved: ResolvedVariant<string>): void {
  const route = entry.route
  if (!route || entry.middleware || getNitroVersion(nuxt) !== 2) {
    return
  }
  const base = route.replace(WILDCARD_SUFFIX_RE, '')
  if (base === route || !base || base === '/') {
    return
  }
  const occupied = nuxt.options.serverHandlers.some(handler => handler.route === base && (!handler.method || handler.method === entry.method))
  if (!occupied) {
    nuxt.options.serverHandlers.push(withVariantMeta({ ...entry, route: base }, resolved))
  }
}

/**
 * Adds a server handler.
 *
 * `handler` is a path, or one path per server API for a module shipping an implementation
 * for each while it migrates: the host runs the one it prefers, and the registration is
 * skipped if it can run none of them.
 *
 * @example
 * ```ts
 * addServerHandler({
 *   route: '/api/test',
 *   handler: {
 *     nuxt: resolver.resolve('./runtime/test'),
 *     nitro2: resolver.resolve('./runtime/test.v2'),
 *   },
 * })
 * ```
 */
export function addServerHandler (handler: ServerHandlerInput): void {
  const nuxt = useNuxt()
  const resolved = resolveVariant('addServerHandler', handler.handler, normalize, SERVER_APIS)
  if (!resolved) {
    return
  }
  // retrieve method from handler file name
  const [, method = undefined] = resolved.value.match(HANDLER_METHOD_RE) || []
  const entry: ServerHandler = {
    method: method?.toUpperCase() as ServerHandler['method'],
    ...handler,
    handler: resolved.value,
  }
  nuxt.options.serverHandlers.push(withVariantMeta(entry, resolved))
  addLegacyBaseRoute(nuxt, entry, resolved)
}

/**
 * Adds a server handler for development only.
 *
 * Variants per server API are resolved as for {@link addServerHandler}.
 */
export function addDevServerHandler (handler: DevServerHandlerInput): void {
  const nuxt = useNuxt()
  const resolved = resolveVariant('addDevServerHandler', handler.handler, value => value, SERVER_APIS)
  if (!resolved) {
    return
  }
  nuxt.options.devServerHandlers.push(withVariantMeta({ ...handler, handler: resolved.value }, resolved))
}

/**
 * Adds a nitro plugin, which runs once when the server starts.
 *
 * `plugin` is a path, or one path per nitro major, resolved as for
 * {@link addServerHandler}. There is no portable variant: `nuxt/server` has no plugin
 * surface, so a plugin is written against nitro.
 */
export function addNitroPlugin (plugin: ServerPluginInput): void {
  const nuxt = useNuxt()
  const resolved = resolveVariant('addNitroPlugin', plugin, normalize, NITRO_APIS)
  if (!resolved) {
    return
  }
  // a host without `_serverPlugins` is nitro v2, where the metadata has no reader
  const plugins = nuxt.options._serverPlugins as ServerPlugin[] | undefined
  if (Array.isArray(plugins)) {
    plugins.push({ plugin: resolved.value, compatibility: resolved.api, unused: resolved.unused })
    return
  }
  nuxt.options.nitro.plugins ||= []
  if (!nuxt.options.nitro.plugins.includes(resolved.value)) {
    nuxt.options.nitro.plugins.push(resolved.value)
  }
}

/** @deprecated Use {@link addNitroPlugin}: a startup plugin is nitro's, not a portable server API. */
export function addServerPlugin (plugin: ServerPluginInput): void {
  addNitroPlugin(plugin)
}

/**
 * Adds routes to be prerendered
 */
export function addPrerenderRoutes (routes: string | string[]): void {
  const nuxt = useNuxt()

  routes = toArray(routes).filter(Boolean)
  if (!routes.length) {
    return
  }
  nuxt.hook('prerender:routes', (ctx) => {
    for (const route of routes) {
      ctx.routes.add(route)
    }
  })
}

/**
 * Access to the Nitro instance
 *
 * **Note:** You can call `useNitro()` only after `ready` hook.
 *
 * **Note:** Changes to the Nitro instance configuration are not applied.
 * @example
 *
 * ```ts
 * nuxt.hook('ready', () => {
 *   console.log(useNitro())
 * })
 * ```
 */
export function useNitro (): NitroInstance {
  const nitro = tryUseNitro()
  if (!nitro) {
    throw kitDiagnostics.NUXT_B8003()
  }
  return nitro
}

/**
 * Access to the Nitro instance, if there is one.
 *
 * Returns `undefined` before the `ready` hook has run, and for the lifetime of the
 * build when the configured `server.builder` is not backed by Nitro (such as the
 * static SPA builder). Prefer this over {@link useNitro} for anything that should
 * still work without a server runtime.
 */
export function tryUseNitro (): NitroInstance | undefined {
  return (tryUseNuxt() as any)?._nitro
}

/**
 * Add server imports to be auto-imported in the server program.
 */
export function addServerImports (imports: NuxtImport | NuxtImport[]): void {
  const nuxt = useNuxt()
  const _imports = toArray(imports)
  if (_imports.length === 0) {
    return
  }
  nuxt.hook('nitro:config', (config) => {
    config.imports ||= {}
    config.imports.imports ||= []
    config.imports.imports.push(..._imports)
  })
}

/**
 * Add directories to be scanned for auto-imports in the server program.
 */
export function addServerImportsDir (dirs: string | string[], opts: { prepend?: boolean } = {}): void {
  const nuxt = useNuxt()
  const _dirs = toArray(dirs)
  if (_dirs.length === 0) {
    return
  }
  nuxt.hook('nitro:config', (config) => {
    config.imports ||= {}
    config.imports.dirs ||= []
    config.imports.dirs[opts.prepend ? 'unshift' : 'push'](..._dirs)
  })
}

/**
 * Add directories to be scanned by Nitro. It will check for subdirectories,
 * which will be registered just like the `~~/server` folder is.
 */
export function addServerScanDir (dirs: string | string[], opts: { prepend?: boolean } = {}): void {
  const nuxt = useNuxt()
  nuxt.hook('nitro:config', (config) => {
    config.scanDirs ||= []

    for (const dir of toArray(dirs)) {
      config.scanDirs[opts.prepend ? 'unshift' : 'push'](dir)
    }
  })
}
