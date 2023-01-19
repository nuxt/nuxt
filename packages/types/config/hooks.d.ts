/**
 * NuxtOptionsHooks
 * Documentation: https://nuxtjs.org/api/configuration-hooks
 *                https://nuxtjs.org/api/internals-nuxt#hooks
 *                https://nuxtjs.org/api/internals-renderer#hooks
 *                https://nuxtjs.org/api/internals-module-container#hooks
 *                https://nuxtjs.org/api/internals-builder#hooks
 *                https://nuxtjs.org/api/internals-generator#hooks
 */

import type { Server as ConnectServer } from 'connect'

export interface NuxtOptionsHooks {
  build?: {
    before?(builder: any, buildOptions: any): void
    compile?(params: { name: 'client' | 'server', compiler: any }): void
    compiled?(params: { name: 'client' | 'server', compiler: any, stats: any }): void
    done?(builder: any): void
    extendRoutes?(routes: any, resolve: any): void
    templates?(params: { templateFiles: any, templateVars: any, resolve: any }): void
  }
  close?(nuxt: any): void
  error?(error: Error): void
  generate?: {
    before?(generator: any, generateOptions: any): void
    distCopied?(generator: any): void
    distRemoved?(generator: any): void
    done?(generator: any): void
    extendRoutes?(routes: any): void
    page?(params: { route: any, path: any, html: any }): void
    routeCreated?(route: any, path: any, errors: any): void
    routeFailed?(route: any, errors: any): void
  }
  listen?(server: any, params: { host: string, port: number | string }): void
  modules?: {
    before?(moduleContainer: any, options: any): void
    done?(moduleContainer: any): void
  }
  ready?(nuxt: any): void
  render?: {
    before?(renderer: any, options: any): void
    done?(renderer: any): void
    errorMiddleware?(app: ConnectServer): void
    resourcesLoaded?(resources: any): void
    route?(url: string, result: any, context: any): void
    routeContext?(context: any): void
    routeDone?(url: string, result: any, context: any): void
    beforeResponse?(url: string, result: any, context: any): void
    setupMiddleware?(app: ConnectServer): void
  }
}

// Hooks need too many core typedefs to be 100% defined
