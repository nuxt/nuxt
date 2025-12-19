import type { RouteRecordRaw } from 'vue-router'
import { joinURL } from 'ufo'
import type { NitroRouteRules } from 'nitro/types'
import { defu } from 'defu'

import { defineNuxtPlugin } from '#app/nuxt'
import { prerenderRoutes } from '#app/composables/ssr'
import _routes from '#build/routes'
import routerOptions, { hashMode } from '#build/router.options.mjs'
// @ts-expect-error virtual file
import { crawlLinks } from '#build/nuxt.config.mjs'
// @ts-expect-error virtual file
import _routeRulesMatcher from '#build/route-rules.mjs'

const routeRulesMatcher = _routeRulesMatcher as (path: string) => NitroRouteRules

let routes: string[]

export default defineNuxtPlugin(async () => {
  if (!import.meta.server || !import.meta.prerender || hashMode) {
    return
  }
  if (routes && !routes.length) { return }

  routes ||= Array.from(processRoutes(await routerOptions.routes?.(_routes) ?? _routes))
  const batch = routes.splice(0, 10)
  prerenderRoutes(batch)
})

// Implementation

const OPTIONAL_PARAM_RE = /^\/?:.*(?:\?|\(\.\*\)\*)$/

function shouldPrerender (path: string) {
  return crawlLinks || !!routeRulesMatcher(path).prerender
}

function processRoutes (routes: readonly RouteRecordRaw[], currentPath = '/', routesToPrerender = new Set<string>()) {
  for (const route of routes) {
    // Add root of optional dynamic paths and catchalls
    if (OPTIONAL_PARAM_RE.test(route.path) && !route.children?.length && shouldPrerender(currentPath)) {
      routesToPrerender.add(currentPath)
    }
    // Skip dynamic paths
    if (route.path.includes(':')) {
      continue
    }
    const fullPath = joinURL(currentPath, route.path)
    if (shouldPrerender(fullPath)) {
      routesToPrerender.add(fullPath)
    }
    if (route.children) {
      processRoutes(route.children, fullPath, routesToPrerender)
    }
  }
  return routesToPrerender
}
