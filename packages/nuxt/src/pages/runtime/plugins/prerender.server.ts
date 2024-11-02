import type { RouteRecordRaw } from 'vue-router'
import { joinURL } from 'ufo'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import defu from 'defu'

import { defineNuxtPlugin, useRuntimeConfig } from '#app/nuxt'
import { prerenderRoutes } from '#app/composables/ssr'
// @ts-expect-error virtual file
import _routes from '#build/routes'
import routerOptions from '#build/router.options'
// @ts-expect-error virtual file
import { crawlLinks } from '#build/nuxt.config.mjs'

let routes: string[]

let _routeRulesMatcher: undefined | ReturnType<typeof toRouteMatcher> = undefined

export default defineNuxtPlugin(async () => {
  if (!import.meta.server || !import.meta.prerender || routerOptions.hashMode) {
    return
  }
  if (routes && !routes.length) { return }

  const routeRules = useRuntimeConfig().nitro!.routeRules
  if (!crawlLinks && routeRules && Object.values(routeRules).some(r => r.prerender)) {
    _routeRulesMatcher = toRouteMatcher(createRadixRouter({ routes: routeRules }))
  }

  routes ||= Array.from(processRoutes(await routerOptions.routes?.(_routes) ?? _routes))
  const batch = routes.splice(0, 10)
  prerenderRoutes(batch)
})

// Implementation

const OPTIONAL_PARAM_RE = /^\/?:.*(?:\?|\(\.\*\)\*)$/

function shouldPrerender (path: string) {
  return !_routeRulesMatcher || defu({} as Record<string, any>, ..._routeRulesMatcher.matchAll(path).reverse()).prerender
}

function processRoutes (routes: RouteRecordRaw[], currentPath = '/', routesToPrerender = new Set<string>()) {
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
