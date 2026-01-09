import type { Nitro, NitroConfig, NitroDevEventHandler, NitroEventHandler, NitroOptions, NitroRouteConfig, NitroRuntimeConfig, NitroRuntimeConfigApp } from 'nitropack/types'
import type { EventHandler, H3Event } from 'h3'
import type { LogObject } from 'consola'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from 'nuxt/app'
import type { HookResult, RuntimeConfig, TSReference } from 'nuxt/schema'

declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
}

declare module 'nitropack/types' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
    appLayout?: string | false
  }
}

// Note: Keep in sync with packages/nuxt/src/core/templates.ts
declare module 'nitropack' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
declare module 'nitropack/types' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}

declare module '@nuxt/schema' {
  interface NuxtHooks {
    /**
     * Called when the dev middleware is being registered on the Nitro dev server.
     * @param handler the Vite or Webpack event handler
     * @returns Promise
     */
    'server:devHandler': (handler: EventHandler, options?: { cors?: () => boolean }) => HookResult

    /**
     * Called before Nitro writes `.nuxt/tsconfig.server.json`, allowing addition of custom references and declarations.
     * @param options Objects containing `references`, `declarations`
     * @returns Promise
     */
    'nitro:prepare:types': (options: { references: TSReference[], declarations: string[] }) => HookResult
    /**
     * Called before initializing Nitro, allowing customization of Nitro's configuration.
     * @param nitroConfig The nitro config to be extended
     * @returns Promise
     */
    'nitro:config': (nitroConfig: NitroConfig) => HookResult
    /**
     * Called after Nitro is initialized, which allows registering Nitro hooks and interacting directly with Nitro.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:init': (nitro: Nitro) => HookResult
    /**
     * Called before building the Nitro instance.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:build:before': (nitro: Nitro) => HookResult
    /**
     * Called after copying public assets. Allows modifying public assets before Nitro server is built.
     * @param nitro The created nitro object
     * @returns Promise
     */
    'nitro:build:public-assets': (nitro: Nitro) => HookResult
  }

  interface ConfigSchema {
    /**
     * Configuration for Nitro.
     *
     * @see [Nitro configuration docs](https://nitro.build/config)
     */
    nitro: NitroConfig

    /**
     * Global route options applied to matching server routes.
     *
     * @experimental This is an experimental feature and API may change in the future.
     *
     * @see [Nitro route rules documentation](https://nitro.build/config#routerules)
     */
    routeRules: NitroConfig['routeRules']

    /**
     * Nitro server handlers.
     *
     * Each handler accepts the following options:
     * - handler: The path to the file defining the handler. - route: The route under which the handler is available. This follows the conventions of [rou3](https://github.com/h3js/rou3). - method: The HTTP method of requests that should be handled. - middleware: Specifies whether it is a middleware handler. - lazy: Specifies whether to use lazy loading to import the handler.
     *
     * @see [`server/` directory documentation](https://nuxt.com/docs/4.x/directory-structure/server)
     *
     * @note Files from `server/api`, `server/middleware` and `server/routes` will be automatically registered by Nuxt.
     *
     * @example
     * ```js
     * serverHandlers: [
     *   { route: '/path/foo/**:name', handler: '~/server/foohandler.ts' }
     * ]
     * ```
     */
    serverHandlers: NitroEventHandler[]

    /**
     * Nitro development-only server handlers.
     *
     * @see [Nitro server routes documentation](https://nitro.build/guide/routing)
     */
    devServerHandlers: NitroDevEventHandler[]
  }

  interface NuxtConfig {
    nitro?: NitroConfig
  }

  interface RuntimeConfig {
    app: NitroRuntimeConfigApp
    /** Only available on the server. */
    nitro?: NitroRuntimeConfig['nitro']
  }

  interface NuxtDebugOptions {
    /** Debug options for Nitro */
    nitro?: NitroOptions['debug']
  }

  interface NuxtPage {
    rules?: NitroRouteConfig
  }
}

export {}
