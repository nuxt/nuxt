/// <reference types="nitropack" />
export * from './dist/index'

import type { SchemaDefinition, RuntimeConfig } from 'nuxt/schema'
import type { NuxtIslandContext, NuxtIslandResponse, NuxtRenderHTMLContext } from './dist/core/runtime/nitro/renderer'

declare global {
  const defineNuxtConfig: typeof import('nuxt/config')['defineNuxtConfig']
  const defineNuxtSchema: (schema: SchemaDefinition) => SchemaDefinition
}

declare module 'nitropack' {
  interface NitroRuntimeConfigApp extends RuntimeConfig['app'] {}
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
