import { defineNuxtRouteMiddleware, navigateTo } from '../composables/router'
import type { RouteMiddleware } from '../composables/router'
import { getRouteRules } from '../composables/manifest'
import { useNuxtApp } from '../nuxt'
import { isAbsoluteHref } from '../utils'

const middleware: RouteMiddleware = defineNuxtRouteMiddleware((to) => {
  // nitro applies `redirect` rules to page requests, but not to the page a `page_*` island renders
  if (import.meta.server ? !useNuxtApp().ssrContext?.islandContext : import.meta.test) { return }
  const rules = getRouteRules({ path: to.path })
  if (rules.redirect) {
    const path = rules.redirect.includes('#') ? rules.redirect : (rules.redirect + to.hash)
    if (import.meta.server) {
      return navigateTo(path, { external: isAbsoluteHref(path) })
    }
    if (isAbsoluteHref(path)) {
      window.location.href = path
      return false
    }
    return path
  }
})

export default middleware
