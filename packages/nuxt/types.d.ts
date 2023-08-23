/// <reference types="nitropack" />
export * from './dist/index'

import type { DefineNuxtConfig } from 'nuxt/config'
import type { SchemaDefinition, RuntimeConfig } from 'nuxt/schema'
import type { H3Event } from 'h3'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from './dist/core/runtime/nitro/renderer'

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
  }
  interface NitroRuntimeHooks {
    'render:html': (htmlContext: NuxtRenderHTMLContext, context: { event: H3Event }) => void | Promise<void>
    'render:island': (islandResponse: NuxtIslandResponse, context: { event: H3Event, islandContext: NuxtIslandContext }) => void | Promise<void>
  }
}
