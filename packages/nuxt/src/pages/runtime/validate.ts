import { createError } from '#app/composables/error'
import { defineNuxtRouteMiddleware } from '#app/composables/router'
import type { RouteMiddleware } from '#app/composables/router'

const middleware: RouteMiddleware = defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta?.validate) { return }

  const result = await Promise.resolve(to.meta.validate(to))
  if (result === true) {
    return
  }

  const error = createError({
    fatal: import.meta.client,
    status: (result && result.status) || 404,
    statusText: (result && result.statusText) || `Page Not Found: ${to.fullPath}`,
    data: {
      path: to.fullPath,
    },
  })

  return error
})

export default middleware
