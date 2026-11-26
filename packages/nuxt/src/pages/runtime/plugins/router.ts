import type { RouteRecordRaw, RouterMatcher } from 'vue-router'
import { createRouter, createRouterMatcher } from 'vue-router'

import { defineNuxtPlugin } from '#app/nuxt'
import { setupNuxtRouter } from '../router-plugin'

import _routes, { handleHotUpdate } from '#build/routes'
import routerOptions from '#build/router.options.mjs'
import { staticRoutes } from '#build/nuxt.config.mjs'

const sharedMatchers = new WeakMap<readonly RouteRecordRaw[], RouterMatcher>()
function getSharedMatcher (routes: readonly RouteRecordRaw[]): RouterMatcher {
  let matcher = sharedMatchers.get(routes)
  if (!matcher) {
    matcher = createRouterMatcher(routes, routerOptions)
    sharedMatchers.set(routes, matcher)
  }
  return matcher
}

export default defineNuxtPlugin({
  name: 'nuxt:router',
  enforce: 'pre',
  setup: setupNuxtRouter(async ({ history, scrollBehavior }) => {
    const routes = routerOptions.routes ? await routerOptions.routes(_routes) ?? _routes : _routes

    const router = createRouter({
      ...routerOptions,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      scrollBehavior,
      history,
      routes,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      matcher: import.meta.server && staticRoutes ? getSharedMatcher(routes) : undefined,
    })

    if (import.meta.hot) {
      handleHotUpdate(staticRoutes ? { ...router } : router, routerOptions.routes ? routerOptions.routes : routes => routes)
    }

    return router
  }),
})
