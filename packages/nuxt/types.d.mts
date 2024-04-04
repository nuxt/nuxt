/// <reference types="nitropack" />

import type { DefineNuxtConfig } from 'nuxt/config'
import type { RuntimeConfig, SchemaDefinition } from 'nuxt/schema'
import type { H3Event } from 'h3'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from './dist/app/types.js'
import type { LogObject } from 'consola'

export * from './dist/index.js'

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
  interface NitroRuntimeConfig extends RuntimeConfig {}
  interface NitroRouteConfig {
    ssr?: boolean
    experimentalNoScripts?: boolean
  }
  interface NitroRouteRules {
    ssr?: boolean
    experimentalNoScripts?: boolean
    appMiddleware?: Record<string, boolean>
  }
  interface NitroRuntimeHooks {
    'dev:ssr-logs': (ctx: { logs: LogObject[], path: string }) => void | Promise<void>
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
