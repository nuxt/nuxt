import { resolveModulePath } from 'exsolve'
import type { Nuxt, NuxtBuildOutputs } from '@nuxt/schema'

import { useNuxt } from '../context.ts'
import { directoryToURL } from './esm.ts'
import { useServerBuild } from './server-build.ts'

// This surface is experimental for as long as `NuxtServerBuild` is, and will change without
// a major release until it has settled.

/** Specifier the SSR renderer reads its build-time configuration from. */
const RENDERER_CONFIG_SPECIFIER = 'nuxt/internal/renderer-config'

/** Specifier a server builder imports `createNuxtRenderer` from. */
const RENDERER_SPECIFIER = 'nuxt/internal/renderer'

/** The portable server surface, whose implementations the configured server builder supplies. */
const SERVER_SPECIFIER = 'nuxt/server'

/** Specifier the shipped `nuxt/server` implementations read runtime configuration from. */
const SERVER_RUNTIME_CONFIG_SPECIFIER = 'nuxt/internal/server-runtime-config'

/** The specifier the renderer imports each build artifact through, and the {@link NuxtBuildOutputs} key that provides it. */
const BUILD_OUTPUT_SPECIFIERS: Record<string, keyof NuxtBuildOutputs> = {
  'nuxt/internal/entry': 'serverEntry',
  'nuxt/internal/manifest': 'clientManifest',
  'nuxt/internal/precomputed': 'clientPrecomputed',
  'nuxt/internal/styles': 'ssrStyles',
  'nuxt/internal/entry-chunk': 'entryChunkName',
  'nuxt/internal/entry-ids': 'entryIds',
}

/** Names of the constants `nuxt/internal/renderer-config` inlines, which documents what each one means. */
export type RendererConfigName =
  | 'NUXT_NO_SSR'
  | 'NUXT_PRERENDER_ERROR_PAGES'
  | 'NUXT_PRERENDER_NO_SSR_ROUTES'
  | 'NUXT_EARLY_HINTS'
  | 'NUXT_NO_SCRIPTS'
  | 'NUXT_NO_SCRIPTS_PROD'
  | 'NUXT_INLINE_STYLES'
  | 'NUXT_VIEW_TRANSITIONS'
  | 'NUXT_NO_SCRIPTS_PATTERNS'
  | 'NUXT_PAGE_PATTERNS'
  | 'NUXT_EARLY_404'
  | 'NUXT_PAGE_MATCHER'
  | 'PARSE_ERROR_DATA'
  | 'NUXT_PAYLOAD_EXTRACTION'
  | 'NUXT_PAYLOAD_INLINE'
  | 'NUXT_RUNTIME_PAYLOAD_EXTRACTION'
  | 'NUXT_SSR_STREAMING'
  | 'NUXT_SSR_STREAMING_BOT_RE'
  | 'appHead'
  | 'appRootTag'
  | 'appRootAttrs'
  | 'appTeleportTag'
  | 'appTeleportAttrs'
  | 'appSpaLoaderTag'
  | 'appSpaLoaderAttrs'
  | 'spaLoadingTemplateOutside'
  | 'spaTemplate'
  | 'appId'
  | 'multiApp'
  | 'componentIslands'
  | 'componentIslandsActive'
  | 'tracingChannelNuxt'

export interface RendererConfigOptions {
  /** JS expressions replacing individual constants, for values a builder resolves itself. */
  overrides?: Partial<Record<RendererConfigName, string>>
  /** Specifier the generated module re-exports unhead's `createHead` options from. */
  unheadOptions?: string
  /** Specifier the generated module re-exports the head module's own render options from. */
  headConfig?: string
  /** Statements prepended to the generated module, for an override that reads a value from an import. */
  prelude?: string
}

/**
 * Generate the body of the `nuxt/internal/renderer-config` module the SSR renderer imports its
 * build-time configuration from.
 *
 * Everything derivable from `nuxt.options` is inlined; the rest defaults to the value of a
 * build without the feature and is replaced through `overrides`.
 *
 * @internal
 */
export function getRendererConfig (options: RendererConfigOptions = {}, nuxt: Nuxt = useNuxt()): string {
  const app = nuxt.options.app
  const noScripts = nuxt.options.features.noScripts
  const payloadExtraction = nuxt.options.experimental.payloadExtraction
  const streaming = nuxt.options.experimental.ssrStreaming
  const streamingEnabled = typeof streaming === 'object' && !!streaming.enabled

  const values: Record<RendererConfigName, string> = {
    NUXT_NO_SSR: String(nuxt.options.ssr === false),
    NUXT_PRERENDER_ERROR_PAGES: '[]',
    NUXT_PRERENDER_NO_SSR_ROUTES: '[]',
    NUXT_EARLY_HINTS: String(nuxt.options.experimental.writeEarlyHints !== false),
    NUXT_NO_SCRIPTS: String(noScripts === 'all' || (!!noScripts && !nuxt.options.dev)),
    NUXT_NO_SCRIPTS_PROD: String(noScripts === 'production'),
    NUXT_INLINE_STYLES: String(!!nuxt.options.features.inlineStyles),
    NUXT_VIEW_TRANSITIONS: String(!!(app.viewTransition && typeof app.viewTransition === 'object' && app.viewTransition.enabled)),
    NUXT_NO_SCRIPTS_PATTERNS: '[]',
    NUXT_PAGE_PATTERNS: '[]',
    NUXT_EARLY_404: 'false',
    NUXT_PAGE_MATCHER: 'undefined',
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    PARSE_ERROR_DATA: String(!!nuxt.options.experimental.parseErrorData),
    NUXT_PAYLOAD_EXTRACTION: String(payloadExtraction !== false),
    NUXT_PAYLOAD_INLINE: String(payloadExtraction !== true),
    NUXT_RUNTIME_PAYLOAD_EXTRACTION: 'false',
    NUXT_SSR_STREAMING: String(streamingEnabled),
    NUXT_SSR_STREAMING_BOT_RE: streamingEnabled && streaming.botRegex instanceof RegExp ? String(streaming.botRegex) : '/^$/',
    appHead: JSON.stringify(app.head),
    appRootTag: JSON.stringify(app.rootTag),
    appRootAttrs: JSON.stringify(app.rootAttrs),
    appTeleportTag: JSON.stringify(app.teleportTag),
    appTeleportAttrs: JSON.stringify(app.teleportAttrs),
    appSpaLoaderTag: JSON.stringify(app.spaLoaderTag),
    appSpaLoaderAttrs: JSON.stringify(app.spaLoaderAttrs),
    spaLoadingTemplateOutside: String(nuxt.options.experimental.spaLoadingTemplateLocation === 'body'),
    spaTemplate: '""',
    appId: JSON.stringify(nuxt.options.appId),
    multiApp: String(!!nuxt.options.future.multiApp),
    componentIslands: 'false',
    componentIslandsActive: 'false',
    tracingChannelNuxt: String(!!(nuxt.options.tracingChannel && typeof nuxt.options.tracingChannel === 'object' && nuxt.options.tracingChannel.nuxt)),
  }

  const lines = [
    ...options.prelude ? [options.prelude] : [],
    `export { default as unheadOptions } from ${JSON.stringify(options.unheadOptions || '#build/unhead-options.mjs')}`,
    `export { iifeChunkFileName, renderSSRHeadOptions } from ${JSON.stringify(options.headConfig || '#build/unhead.config.mjs')}`,
  ]
  for (const name in values) {
    const key = name as RendererConfigName
    lines.push(`export const ${key} = ${options.overrides?.[key] ?? values[key]}`)
  }

  return lines.join('\n')
}

/**
 * The build-time replacements the renderer must be compiled with. A builder that does not
 * apply them ships both sides of every branch, and reaches the runtime with
 * `import.meta.prerender` undefined.
 *
 * @internal
 */
export function getRendererDefines (phase: 'server' | 'prerender', nuxt: Nuxt = useNuxt()): Record<string, string> {
  return {
    'import.meta.dev': String(!!nuxt.options.dev),
    'import.meta.server': 'true',
    'import.meta.client': 'false',
    'import.meta.prerender': String(phase === 'prerender'),
  }
}

/**
 * The module backing `nuxt/server` in the server bundle: the one the configured server
 * builder supplies, or the web-standard implementations Nuxt ships.
 *
 * The default is resolved to a file rather than left as `nuxt/server`, which the bundle
 * resolves to the module being generated here.
 */
function getServerSurfaceModule (nuxt: Nuxt): string {
  const delegate = useServerBuild(nuxt).runtime.server
  if (delegate) {
    return delegate
  }
  return resolveModulePath('nuxt/server', {
    from: [...(nuxt.options.modulesDir || []).filter(Boolean).map(dir => directoryToURL(dir)), import.meta.url],
  })
}

/**
 * Version of the server runtime contract, bumped whenever a server builder has to do
 * something different with what {@link getServerRuntime} hands it. A builder compares it
 * against the version it was written for, so a mismatch is a build-time error rather than
 * a module that silently resolves to a stub.
 */
export const SERVER_RUNTIME_VERSION = 1

/** A module the SSR renderer imports, whose body only the build knows. */
export interface NuxtServerRuntimeModule {
  /**
   * The module body. Read lazily, and more than once, so a builder may register the module
   * before the value exists and still resolve the finalised one.
   */
  code: () => string | Promise<string>
  /** The {@link NuxtBuildOutputs} key backing the module, absent for a module core generates itself. */
  output?: keyof NuxtBuildOutputs
}

/** What core provides for a server builder to render with. See {@link getServerRuntime}. */
export interface NuxtServerRuntime {
  /** See {@link SERVER_RUNTIME_VERSION}. */
  version: number
  /**
   * Modules the renderer imports and the builder must resolve, keyed by specifier. A builder
   * registers each one however its bundler prefers (a virtual module, an alias, a file it
   * writes) without knowing what any of them mean.
   */
  modules: Record<string, NuxtServerRuntimeModule>
  /**
   * Build-time replacements the renderer must be compiled with. A builder that does not
   * apply them ships both sides of every branch, and reaches the runtime with
   * `import.meta.prerender` undefined, which silently disables payload extraction.
   */
  defines: Record<string, string>
  /** Specifier the builder imports `createNuxtRenderer` from in the module it makes its server entry. */
  entry: string
}

export interface ServerRuntimeOptions extends Omit<RendererConfigOptions, 'overrides'> {
  /** The phase the bundle renders in, which `import.meta.prerender` folds against. */
  phase?: 'server' | 'prerender'
  /**
   * JS expressions replacing individual renderer constants, for values a builder resolves
   * itself. A function is called each time the module body is read, so a value that is only
   * final after another part of the build has run can be provided as one.
   */
  overrides?: RendererConfigOptions['overrides'] | (() => RendererConfigOptions['overrides'] | Promise<RendererConfigOptions['overrides']>)
}

/**
 * Everything core provides for a server builder to stand up the SSR renderer with: the
 * modules the renderer imports, the defines it must be compiled with, and the specifier
 * its server entry creates the renderer from.
 *
 * Core owns the set of modules, so a builder that iterates them keeps working when the set
 * changes; {@link SERVER_RUNTIME_VERSION} is what tells it when it cannot.
 *
 * @internal
 */
export function getServerRuntime (options: ServerRuntimeOptions = {}, nuxt: Nuxt = useNuxt()): NuxtServerRuntime {
  const { phase = 'server', overrides, ...rendererConfig } = options

  const modules: Record<string, NuxtServerRuntimeModule> = {
    [RENDERER_CONFIG_SPECIFIER]: {
      code: async () => getRendererConfig({
        ...rendererConfig,
        overrides: typeof overrides === 'function' ? await overrides() : overrides,
      }, nuxt),
    },
  }

  for (const specifier in BUILD_OUTPUT_SPECIFIERS) {
    const output = BUILD_OUTPUT_SPECIFIERS[specifier]!
    modules[specifier] = { output, code: () => nuxt.buildOutputs[output]() }
  }

  modules[SERVER_SPECIFIER] = { code: () => `export * from ${JSON.stringify(getServerSurfaceModule(nuxt))}` }
  modules[SERVER_RUNTIME_CONFIG_SPECIFIER] = { code: () => `export { useRuntimeConfig } from ${JSON.stringify(useServerBuild(nuxt).runtime.runtimeConfig)}` }

  return {
    version: SERVER_RUNTIME_VERSION,
    modules,
    defines: getRendererDefines(phase, nuxt),
    entry: RENDERER_SPECIFIER,
  }
}
