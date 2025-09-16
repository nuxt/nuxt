import { hasProtocol } from 'ufo'
import { defineNuxtRouteMiddleware } from '../composables/router'
import { getRouteRules } from '../composables/manifest'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || import.meta.test) { return }
  const rules = await getRouteRules({ path: to.path })
  if (rules.redirect) {
    const hash = to.hash
    const redirectHasHash = rules.redirect.includes('#')
    if (hasProtocol(rules.redirect, { acceptRelative: true })) {
      window.location.href = rules.redirect + (redirectHasHash ? '' : hash)
      return false
    }
    return rules.redirect + (redirectHasHash ? '' : hash)
  }
})
