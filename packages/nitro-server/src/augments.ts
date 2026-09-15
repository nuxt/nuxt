/// <reference path="./internal.d.ts" />
import type { Nitro, NitroConfig, NitroDevEventHandler, NitroEventHandler, NitroOptions, NitroRuntimeConfig, NormalizedRouteRules, RouteRuleConfig, TracingOptions } from 'nitro/types'
import type { EventHandler, H3Event } from 'nitro/h3'
import type { LogObject } from 'consola'
import type { NitroLegacyOptions } from './compat.ts'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderChunkContext, NuxtRenderCloseContext, NuxtRenderHTMLContext, NuxtRenderRouteContext } from '#app/types'
import type { NuxtRequestContext, RouteRuleConfigExtensions, RuntimeConfig, ServerImportsOptions, TracingChannelOptions } from 'nuxt/schema'

/**
 * Per-channel toggles for `tracingChannel`: Nitro's own {@link TracingOptions}, plus the
 * Nuxt-owned channels.
 *
 * @experimental Channel names, payload shapes, and option keys may change.
 */
export type NuxtTracingChannelOptions = TracingChannelOptions

declare module 'nitro/types' {
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

  interface ConfigSchema {
    /**
     * Opt-in Nitro v2 compatibility for your own server code (the `server/` directory
     * and project code it imports). Pass `true` to enable every toggle, or an object to
     * disable individual ones. Modules registering Nitro v2 server code through
     * `@nuxt/kit` are handled automatically and are unaffected by this option.
     *
     * Transitional: this option and the compatibility layer behind it are removed in
     * Nuxt 6. Prefer importing from `nuxt/server`.
     *
     * @note Enabling this, or installing any module whose server code imports from `h3`
     * or `nitropack`, also turns on Nitro v2 error-shape recovery app-wide: an error
     * thrown as `{ statusCode, statusMessage }` keeps that status instead of being
     * scrubbed to a 500.
     *
     * @default false
     */
    nitroLegacy: boolean | NitroLegacyOptions
  }

  interface NuxtConfig {
    nitroLegacy?: boolean | NitroLegacyOptions
  }

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

  interface ConfigSchema {
    /**
     * Opt-in Nitro v2 compatibility for your own server code (the `server/` directory
     * and project code it imports). Pass `true` to enable every toggle, or an object to
     * disable individual ones. Modules registering Nitro v2 server code through
     * `@nuxt/kit` are handled automatically and are unaffected by this option.
     *
     * Transitional: this option and the compatibility layer behind it are removed in
     * Nuxt 6. Prefer importing from `nuxt/server`.
     *
     * @note Enabling this, or installing any module whose server code imports from `h3`
     * or `nitropack`, also turns on Nitro v2 error-shape recovery app-wide: an error
     * thrown as `{ statusCode, statusMessage }` keeps that status instead of being
     * scrubbed to a 500.
     *
     * @default false
     */
    nitroLegacy: boolean | NitroLegacyOptions
  }

  interface NuxtConfig {
    nitroLegacy?: boolean | NitroLegacyOptions
  }

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
