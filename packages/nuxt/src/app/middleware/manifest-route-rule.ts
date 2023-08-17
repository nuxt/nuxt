import { defineNuxtRouteMiddleware } from '#app/composables/router'
import { getRouteRules } from '#app/composables/manifest'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || import.meta.test) { return }
  const rules = await getRouteRules(to.path)
  if (rules.redirect) {
    return rules.redirect
  }
})
