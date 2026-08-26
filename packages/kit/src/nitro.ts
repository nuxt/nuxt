import { normalize } from 'pathe'
import { resolveModulePath } from 'exsolve'
import type { NitroInstance, Nuxt, NuxtImport } from '@nuxt/schema'
import type { NitroCompatibilityVersion, NitroDevEventHandler, NitroDevEventHandlerV2, NitroDevEventHandlerV3, NitroEventHandler, NitroEventHandlerV2, NitroEventHandlerV3 } from './nitro-types.ts'

import { useNuxt } from './context.ts'
import { getNitroVersion } from './compatibility.ts'
import { resolveAlias } from './resolve.ts'
import { toArray } from './utils.ts'
import { kitDiagnostics } from './diagnostics/kit-api.ts'

export type { NitroCompatibilityVersion } from './nitro-types.ts'

export interface NitroVersionOptions {
  /**
   * The nitro major version the handler or plugin is written for.
   *
   * Untagged registrations are interpreted as nitro v2. Modules written for nitro v3
   * should pass `version: 3` (or use `createNitroHelpers()` to bind it once);
   * `meta.compatibility.nitro` is a requirement check only and does not affect this.
   */
  version?: NitroCompatibilityVersion
}

/**
 * Per-nitro-major variants of a server registration. The host picks the variant
 * matching its nitro major. On a nitro v3 host a v2-only variant is still
 * registered (and wrapped at runtime); on a nitro v2 host a v3-only variant is
 * skipped.
 */
export interface NitroVersionedInput<V2, V3> {
  2?: V2
  3?: V3
}

interface ResolvedRegistration<T> {
  value: T
  version?: NitroCompatibilityVersion
}

function recordSkippedRegistration (api: string, version: number, host: number | undefined): void {
  kitDiagnostics.NUXT_B8024({ api, version, host: host ?? 2 })
  const nuxt = useNuxt()
  nuxt._skippedNitroRegistrations ||= []
  nuxt._skippedNitroRegistrations.push({ api, version, host })
}

function resolveVersionedRegistration<V2, V3> (
  input: V2 | V3 | NitroVersionedInput<V2, V3>,
  isVersionedInput: (input: V2 | V3 | NitroVersionedInput<V2, V3>) => input is NitroVersionedInput<V2, V3>,
  explicit: NitroCompatibilityVersion | undefined,
  api: string,
): ResolvedRegistration<V2 | V3> | undefined {
  if (isVersionedInput(input)) {
    const host = getNitroVersion()
    const hostVersion = host ?? 2
    const exact = input[hostVersion as NitroCompatibilityVersion]
    if (exact !== undefined) {
      return { value: exact, version: hostVersion as NitroCompatibilityVersion }
    }
    if (hostVersion > 2 && input[2] !== undefined) {
      return { value: input[2], version: 2 }
    }
    recordSkippedRegistration(api, 3, host)
    return
  }

  // an untagged or v2 registration is what every existing module does, so it must
  // never depend on being able to detect the host nitro version
  const version = explicit
  if (version !== undefined && version > 2) {
    const host = getNitroVersion()
    if (host !== undefined && version > host) {
      recordSkippedRegistration(api, version, host)
      return
    }
  }
  return { value: input as V2 | V3, version }
}

function isVersionedHandler<V2 extends { handler: unknown }, V3 extends { handler: unknown }> (input: V2 | V3 | NitroVersionedInput<V2, V3>): input is NitroVersionedInput<V2, V3> {
  return !('handler' in input)
}

/**
 * Catch `{ route, handler: { 2: ..., 3: ... } }`, where the variant map was put on
 * the `handler` field instead of the registration; nitro would otherwise fail deep
 * inside its handler normalization.
 */
function assertHandlerNotVersioned (input: { handler?: unknown }, api: string): void {
  const handler = input.handler
  if (handler && typeof handler === 'object' && (2 in handler || 3 in handler)) {
    throw kitDiagnostics.NUXT_B8025({ api })
  }
}

const HANDLER_METHOD_RE = /\.(get|head|patch|post|put|delete|connect|options|trace)(\.\w+)*$/
type HANDLER_METHOD_RE = 'get' | 'head' | 'patch' | 'post' | 'put' | 'delete' | 'connect' | 'options' | 'trace'
/**
 * normalize handler object
 *
 */
function normalizeHandlerMethod (handler: NitroEventHandler) {
  // retrieve method from handler file name
  const [, method = undefined] = handler.handler.match(HANDLER_METHOD_RE) || []
  return {
    method: method?.toUpperCase() as Uppercase<HANDLER_METHOD_RE> | undefined,
    ...handler,
    handler: normalize(handler.handler),
  }
}

/**
 * Adds a nitro server handler
 *
 */
export function addServerHandler (handler: NitroVersionedInput<NitroEventHandlerV2, NitroEventHandlerV3>): void
export function addServerHandler (handler: NitroEventHandlerV3, options: { version: 3 }): void
export function addServerHandler (handler: NitroEventHandlerV2, options?: { version?: 2 }): void
export function addServerHandler (handler: NitroEventHandler | NitroVersionedInput<NitroEventHandlerV2, NitroEventHandlerV3>, options: NitroVersionOptions = {}): void {
  const nuxt = useNuxt()
  const resolved = resolveVersionedRegistration(handler, isVersionedHandler, options.version, 'addServerHandler')
  if (!resolved) {
    return
  }
  assertHandlerNotVersioned(resolved.value as { handler?: unknown }, 'addServerHandler')
  const normalized = normalizeHandlerMethod(resolved.value)
  nuxt.options.serverHandlers.push((resolved.version === undefined ? normalized : { ...normalized, version: resolved.version }) as any)
}

/**
 * Adds a nitro server handler for development-only
 *
 */
export function addDevServerHandler (handler: NitroVersionedInput<NitroDevEventHandlerV2, NitroDevEventHandlerV3>): void
export function addDevServerHandler (handler: NitroDevEventHandlerV3, options: { version: 3 }): void
export function addDevServerHandler (handler: NitroDevEventHandlerV2, options?: { version?: 2 }): void
export function addDevServerHandler (handler: NitroDevEventHandler | NitroVersionedInput<NitroDevEventHandlerV2, NitroDevEventHandlerV3>, options: NitroVersionOptions = {}): void {
  const nuxt = useNuxt()
  const resolved = resolveVersionedRegistration(handler, isVersionedHandler, options.version, 'addDevServerHandler')
  if (!resolved) {
    return
  }
  assertHandlerNotVersioned(resolved.value as { handler?: unknown }, 'addDevServerHandler')
  nuxt.options.devServerHandlers.push((resolved.version === undefined ? resolved.value : { ...resolved.value, version: resolved.version }) as any)
}

/**
 * Adds a Nitro plugin
 */
export function addServerPlugin (plugin: string | NitroVersionedInput<string, string>, options: NitroVersionOptions = {}): void {
  const nuxt = useNuxt()
  const resolved = resolveVersionedRegistration<string, string>(plugin, (input): input is NitroVersionedInput<string, string> => typeof input !== 'string', options.version, 'addServerPlugin')
  if (!resolved) {
    return
  }
  const path = normalize(resolved.value)
  nuxt.options.nitro.plugins ||= []
  nuxt.options.nitro.plugins.push(path)
  if (resolved.version !== undefined) {
    const versions = (nuxt._serverPluginVersions ||= new Map())
    versions.set(path, resolved.version)
    // record the alias-resolved form too: `nuxt.options.nitro.plugins` entries are
    // alias-mapped before the compat layer looks the tag up
    const aliased = normalize(resolveAlias(path, nuxt.options.alias))
    if (aliased !== path) {
      versions.set(aliased, resolved.version)
    }
    // the specifier is usually extensionless, which never matches a bundler module id
    const file = resolveModulePath(aliased, {
      try: true,
      extensions: nuxt.options.extensions,
      from: [nuxt.options.rootDir, import.meta.url],
    })
    if (file) {
      versions.set(normalize(file), resolved.version)
    }
  }
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
  const nuxt = useNuxt()
  if (!(nuxt as any)._nitro) {
    throw kitDiagnostics.NUXT_B8003()
  }
  return (nuxt as any)._nitro
}

/**
 * Record the nitro major a server-side source belongs to.
 *
 * Auto-import sources, scanned directories and server template ids are not
 * versioned registrations in the way a handler is, but `@nuxt/nitro-server`
 * needs to know which of them point at nitro v2 module code so it can scope the
 * v2 compatibility transform to them. Absent entries are nitro v2, matching the
 * rest of the tag contract.
 * @internal
 */
export function recordServerSource (nuxt: Nuxt, source: string, version: NitroCompatibilityVersion | undefined): void {
  if (version === undefined) {
    return
  }
  const versions = (nuxt._serverImportVersions ||= new Map())
  versions.set(normalize(source), version)
}

/**
 * Add server imports to be auto-imported by Nitro
 */
export function addServerImports (imports: NuxtImport | NuxtImport[], options: NitroVersionOptions = {}): void {
  const nuxt = useNuxt()
  const _imports = toArray(imports)
  for (const item of _imports) {
    if (typeof item.from === 'string') {
      recordServerSource(nuxt, item.from, options.version)
    }
  }
  nuxt.hook('nitro:config', (config) => {
    config.imports ||= {}
    config.imports.imports ||= []
    config.imports.imports.push(..._imports)
  })
}

/**
 * Add directories to be scanned for auto-imports by Nitro
 */
export function addServerImportsDir (dirs: string | string[], opts: { prepend?: boolean } & NitroVersionOptions = {}): void {
  const nuxt = useNuxt()
  const _dirs = toArray(dirs)
  for (const dir of _dirs) {
    recordServerSource(nuxt, dir, opts.version)
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
