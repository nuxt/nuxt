import { hasProtocol } from 'ufo'
import { defineNuxtRouteMiddleware } from '../composables/router'
import { getRouteRules } from '../composables/manifest'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || import.meta.test) { return }
  const rules = getRouteRules({ path: to.path })
  if (rules.redirect) {
    const path = rules.redirect.includes('#') ? rules.redirect : (rules.redirect + to.hash)
    if (hasProtocol(path, { acceptRelative: true })) {
      window.location.href = path
      return false
    }
    return path
  }
})
