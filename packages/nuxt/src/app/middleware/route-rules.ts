import { defineNuxtRouteMiddleware } from '../composables/router'
import type { RouteMiddleware } from '../composables/router'
import { getRouteRules } from '../composables/manifest'
import { isAbsoluteHref } from '../utils'

const middleware: RouteMiddleware = defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || import.meta.test) { return }
  const rules = getRouteRules({ path: to.path })
  if (rules.redirect) {
    const path = rules.redirect.includes('#') ? rules.redirect : (rules.redirect + to.hash)
    if (isAbsoluteHref(path)) {
      window.location.href = path
      return false
    }
    return path
  }
})

export default middleware
