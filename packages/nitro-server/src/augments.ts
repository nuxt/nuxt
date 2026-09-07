/// <reference path="./internal.d.ts" />
import type {} from 'nitropack'
import type { Nitro, NitroConfig, NitroDevEventHandler, NitroEventHandler, NitroOptions, NitroRouteConfig, NitroRouteRules, NitroRuntimeConfig } from 'nitropack/types'
import type { EventHandler, H3Event } from 'h3'
import type { LogObject } from 'consola'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '#app/types'
import type { NuxtRequestContext, RouteRuleConfigExtensions, RuntimeConfig, TracingChannelOptions } from 'nuxt/schema'

/** The channels this package's runtime forwards, alongside the Nuxt-owned ones. */
interface NitroTracingChannels {
  srvx?: boolean
  h3?: boolean
  unstorage?: boolean
}

/**
 * Per-channel toggles for `tracingChannel`: the channels this runtime forwards, plus the
 * Nuxt-owned channels.
 *
 * @experimental Channel names, payload shapes, and option keys may change.
 */
export type NuxtTracingChannelOptions = TracingChannelOptions

declare global {
  interface ImportMeta {
    dev: boolean
    test: boolean
  }
}

declare module 'nitropack' {
  interface NitroRouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
  interface NitroConfig {
    tracingChannel?: boolean | NuxtTracingChannelOptions
  }
}

declare module 'nitropack/types' {
  interface NitroRouteRules {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
  interface NitroConfig {
    tracingChannel?: boolean | NuxtTracingChannelOptions
  }
}

// Note: Keep in sync with packages/nuxt/src/core/templates.ts
declare module 'nitropack' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  // rules Nuxt generates types for are declared on `@nuxt/schema`, and bridged here so that
  // configuration typed by nitro accepts them too
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRouteConfig extends RouteRuleConfigExtensions {}
  interface NitroRouteConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
declare module 'nitropack/types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRouteConfig extends RouteRuleConfigExtensions {}
  interface NitroRouteConfig {
    ssr?: boolean
    streaming?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event, streaming?: boolean }) => void | Promise<void>
    'render:html:chunk': (chunkContext: NuxtRenderChunkContext, context: { event: H3Event }) => void | Promise<void>
    'render:html:close': (closeContext: NuxtRenderCloseContext, context: { event: H3Event }) => void | Promise<void>
    'render:route': (renderRouteContext: NuxtRenderRouteContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}

/** The types this package contributes to Nuxt's build-time registry. */
interface NitroSchemaTypes {
  instance: Nitro
  config: NitroConfig
  handler: NitroEventHandler
  devHandler: NitroDevEventHandler
  routeRuleConfig: NitroRouteConfig
  tracingChannels: NitroTracingChannels
}

/** The types this package's runtime contributes to the app layer. */
interface NitroServerTypes {
  event: H3Event
  eventHandler: EventHandler
  routeRules: NitroRouteRules
}

declare module '@nuxt/schema' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroTypes extends NitroSchemaTypes {}

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ServerTypes extends NitroServerTypes {}

  interface RuntimeConfig {
    /** Only available on the server. */
    nitro?: NitroRuntimeConfig['nitro']
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
    nitro?: NitroRuntimeConfig['nitro']
  }

  interface NuxtDebugOptions {
    /** Debug options for Nitro */
    nitro?: NitroOptions['debug']
  }
}

export type { NuxtRequestContext } from 'nuxt/schema'

declare module 'h3' {
  interface H3EventContext {
    nuxt?: NuxtRequestContext
  }
}

export {}
