import { createError, showError } from '#app/composables/error'
import { useNuxtApp } from '#app/nuxt'
import { defineNuxtRouteMiddleware } from '#app/composables/router'

export default defineNuxtRouteMiddleware(async (to, from) => {
  if (!to.meta?.validate) { return }

  const nuxtApp = useNuxtApp()

  const result = await Promise.resolve(to.meta.validate(to))
  if (result === true) {
    return
  }

  const error = createError({
    statusCode: (result && result.statusCode) || 404,
    statusMessage: (result && result.statusMessage) || `Page Not Found: ${to.fullPath}`,
    data: {
      path: to.fullPath,
    },
  })

  await nuxtApp.runWithContext(() => showError(error))

  // We pretend to have navigated to the invalid route so
  // that the user can return to the previous page with
  // the back button.
  if (typeof window !== 'undefined') {
    window.history.pushState({}, '', from.fullPath)
  }

  return error
})
