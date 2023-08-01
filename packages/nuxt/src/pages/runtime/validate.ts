import { createError, showError } from '#app/composables/error'
import { useNuxtApp } from '#app/nuxt'
import { defineNuxtRouteMiddleware, useRouter } from '#app/composables/router'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta?.validate) { return }

  const nuxtApp = useNuxtApp()
  const router = useRouter()

  const result = await Promise.resolve(to.meta.validate(to))
  if (result === true) {
    return
  }
  if (import.meta.server) {
    return result
  }
  const error = createError({
    statusCode: 404,
    statusMessage: `Page Not Found: ${to.fullPath}`
  })
  const unsub = router.beforeResolve((final) => {
    unsub()
    if (final === to) {
      const unsub = router.afterEach(async () => {
        unsub()
        await nuxtApp.runWithContext(() => showError(error))
        // We pretend to have navigated to the invalid route so
        // that the user can return to the previous page with
        // the back button.
        window.history.pushState({}, '', to.fullPath)
      })
      // We stop the navigation immediately before it resolves
      // if there is no other route matching it.
      return false
    }
  })
})
