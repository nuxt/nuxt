/// <reference path="./internal.d.ts" />
import type { Nitro, NitroConfig, NitroDevEventHandler, NitroEventHandler, NitroOptions, NitroRuntimeConfig, NormalizedRouteRules, RouteRuleConfig, TracingOptions } from 'nitro/types'
import type { EventHandler, H3Event } from 'nitro/h3'
import type { LogObject } from 'consola'
import type { RawSourceMap } from 'my-bad'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '#app/types'
import type { NuxtRequestContext, RouteRuleConfigExtensions, RuntimeConfig, ServerImportsOptions, TracingChannelOptions } from 'nuxt/schema'

/**
 * Per-channel toggles for `tracingChannel`: Nitro's own {@link TracingOptions}, plus the
 * Nuxt-owned channels.
 *
 * @experimental Channel names, payload shapes, and option keys may change.
 */
export type NuxtTracingChannelOptions = TracingChannelOptions

/**
 * Dev-only access to the sourcemaps of the SSR bundle, registered by the
 * bundler when it evaluates SSR modules in the Nitro process.
 *
 * @experimental
 */
export interface SSRSourceMaps {
  /** Sourcemap for the given absolute module path, if one is known. */
  getSourceMap?: (file: string) => RawSourceMap | undefined
  /** Rewrite the positions in a stack string to source positions. */
  fixStacktrace?: (stack: string) => string
  /** Transformed code of an SSR module as it was evaluated, if the runner still holds it. */
  getCode: (file: string) => string | undefined
  /** Position in generated code a source position was mapped from. */
  getCompiledPosition?: (file: string, line: number, column?: number) => { file: string, line: number, column: number } | undefined
  /** Whether `error.stack` already holds source positions when an error is raised. */
  stacksAreMapped: boolean
}

declare module 'nitro/types' {
  interface NitroApp {
    /**
     * Only set in development, by bundlers that evaluate the SSR bundle within
     * the Nitro process.
     *
     * @experimental
     */
    ssrSourceMaps?: SSRSourceMaps
  }
  /** The channel `addServerImports()` and `addServerImportsDir()` write to through `nitro:config`. */
  interface NitroConfig {
    imports?: false | ServerImportsOptions
  }
}

declare module 'h3/rules' {
  // rules Nuxt generates types for are declared on `@nuxt/schema`, and bridged here so that
  // configuration typed by nitro accepts them too
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RouteRuleConfig extends RouteRuleConfigExtensions {}
  interface RouteRuleConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface RouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
}

// Note: Keep in sync with packages/nuxt/src/core/templates.ts
declare module 'nitro/types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}

type _NitroOnlyRuntimeConfig = Omit<NonNullable<NitroRuntimeConfig['nitro']>, 'envPrefix'> & { envPrefix: string }

/** The types this package contributes to Nuxt's build-time registry. */
interface NitroSchemaTypes {
  instance: Nitro
  config: NitroConfig
  handler: NitroEventHandler
  devHandler: NitroDevEventHandler
  routeRuleConfig: RouteRuleConfig
  tracingChannels: TracingOptions
}

/** The types this package's runtime contributes to the app layer. */
interface NitroServerTypes {
  event: H3Event
  eventHandler: EventHandler
  routeRules: NormalizedRouteRules
}

declare module '@nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroTypes extends NitroSchemaTypes {}

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ServerTypes extends NitroServerTypes {}

  interface RuntimeConfig {
    /** Only available on the server. */
    nitro?: _NitroOnlyRuntimeConfig
  }

  interface NuxtDebugOptions {
    /** Debug options for Nitro */
    nitro?: NitroOptions['debug']
  }
}

declare module 'nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroTypes extends NitroSchemaTypes {}

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ServerTypes extends NitroServerTypes {}

  interface RuntimeConfig {
    /** Only available on the server. */
    nitro?: _NitroOnlyRuntimeConfig
  }

  interface NuxtDebugOptions {
    /** Debug options for Nitro */
    nitro?: NitroOptions['debug']
  }
}

export type { NuxtRequestContext } from 'nuxt/schema'

declare module 'srvx' {
  interface ServerRequestContext {
    nuxt?: NuxtRequestContext
  }
}

declare module 'h3' {
  interface H3EventContext {
    nuxt?: NuxtRequestContext
  }
}

export {}
