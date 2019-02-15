
/**
 * NuxtConfigurationRouter
 * Documentation: https://nuxtjs.org/api/configuration-router
 *                https://router.vuejs.org/api/#router-construction-options
 */

import { RouterOptions, Route } from 'vue-router'

export interface NuxtConfigurationRouter extends RouterOptions {
  routeNameSplitter?: string
  extendRoutes?: (routes: Route[], resolve: (...pathSegments: string[]) => string) => void
  linkPrefetchedClass?: string
  middleware?: string | string[]
  prefetchLinks?: boolean
}
