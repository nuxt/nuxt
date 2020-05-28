
/**
 * NuxtConfigurationRouter
 * Documentation: https://nuxtjs.org/api/configuration-router
 *                https://router.vuejs.org/api/#router-construction-options
 */

import { RouterOptions, RouteConfig } from 'vue-router'

export interface NuxtRouteConfig extends Pick<RouteConfig, Exclude<keyof RouteConfig, 'children' | 'component'>> {
  children?: NuxtRouteConfig[]
  chunkName?: string
  chunkNames?: Record<string, string>
  component?: RouteConfig['component'] | string
}

export interface NuxtConfigurationRouter extends RouterOptions {
  routeNameSplitter?: string
  extendRoutes?(routes: NuxtRouteConfig[], resolve: (...pathSegments: string[]) => string): void
  linkPrefetchedClass?: string
  middleware?: string | string[]
  prefetchLinks?: boolean
  trailingSlash?: boolean
}
