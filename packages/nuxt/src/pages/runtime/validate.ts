import { createError } from '#app/composables/error'
import { defineNuxtRouteMiddleware } from '#app/composables/router'

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (!to.meta?.validate) { return }

  const result = await Promise.resolve(to.meta.validate(to))
  if (result === true) {
    return
  }

  const error = createError({
    fatal: import.meta.client,
    statusCode: (result && result.statusCode) || 404,
    statusMessage: (result && result.statusMessage) || `Page Not Found: ${to.fullPath}`,
    data: {
      path: to.fullPath,
    },
  })

  // We pretend to have navigated to the invalid route so
  // that the user can return to the previous page with
  // the back button.
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', from.fullPath)
  }

  return error
})
