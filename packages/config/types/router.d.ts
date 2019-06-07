
/**
 * NuxtConfigurationRouter
 * Documentation: https://nuxtjs.org/api/configuration-router
 *                https://router.vuejs.org/api/#router-construction-options
 */

import { RouterOptions, RouteConfig } from 'vue-router'

export interface NuxtRouteConfig extends RouteConfig {
  chunkNames: { [key: string]: string }
  component?: RouteConfig['component'] | string
  children?: NuxtRouteConfig[]
}

export interface NuxtConfigurationRouter extends RouterOptions {
  routeNameSplitter?: string
  extendRoutes?(routes: NuxtRouteConfig[], resolve: (...pathSegments: string[]) => string): void
  linkPrefetchedClass?: string
  middleware?: string | string[]
  prefetchLinks?: boolean
}
