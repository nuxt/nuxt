/// <reference types="nitropack" />
/// <reference path="dist/app/types/augments.d.ts" />

import type { H3Event } from 'h3'
import type { LogObject } from 'consola'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from './dist/app/types'
import type { RuntimeConfig, SchemaDefinition } from 'nuxt/schema'
import type { DefineNuxtConfig } from 'nuxt/config'

export * from './dist/index'

declare global {
  const defineNuxtConfig: DefineNuxtConfig
  const defineNuxtSchema: (schema: SchemaDefinition) => SchemaDefinition
}

// Note: Keep in sync with packages/nuxt/src/core/templates.ts
declare module 'nitropack' {
  interface NitroRuntimeConfigApp {
    buildAssetsDir: string
    cdnURL: string
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    noScripts?: boolean
    /** @deprecated Use `noScripts` instead */
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
