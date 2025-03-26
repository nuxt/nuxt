import { hasProtocol } from 'ufo'
import { defineNuxtRouteMiddleware } from '../composables/router'
import { getRouteRules } from '../composables/manifest'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || import.meta.test) { return }
  const rules = await getRouteRules({ path: to.path })
  if (rules.redirect) {
    if (hasProtocol(rules.redirect, { acceptRelative: true })) {
      window.location.href = rules.redirect
      return false
    }
    return rules.redirect
  }
})
