import type { RouteRecordRaw } from 'vue-router'
import { joinURL } from 'ufo'

import { defineNuxtPlugin } from '#app/nuxt'
import { prerenderRoutes } from '#app/composables/ssr'
// @ts-expect-error virtual file
import _routes from '#build/routes'
// @ts-expect-error virtual file
import routerOptions from '#build/router.options'

let routes: string[]

export default defineNuxtPlugin(async () => {
  if (!import.meta.server || !import.meta.prerender || routerOptions.hashMode) {
    return
  }
  if (routes && !routes.length) { return }

  routes ||= Array.from(processRoutes(await routerOptions.routes?.(_routes) ?? _routes))
  const batch = routes.splice(0, 10)
  prerenderRoutes(batch)
})

// Implementation

const OPTIONAL_PARAM_RE = /^\/?:.*(\?|\(\.\*\)\*)$/

function processRoutes (routes: RouteRecordRaw[], currentPath = '/', routesToPrerender = new Set<string>()) {
  for (const route of routes) {
    // Add root of optional dynamic paths and catchalls
    if (OPTIONAL_PARAM_RE.test(route.path) && !route.children?.length) {
      routesToPrerender.add(currentPath)
    }
    // Skip dynamic paths
    if (route.path.includes(':')) {
      continue
    }
    const fullPath = joinURL(currentPath, route.path)
    routesToPrerender.add(fullPath)
    if (route.children) {
      processRoutes(route.children, fullPath, routesToPrerender)
    }
  }
  return routesToPrerender
}
