import { createError, defineNuxtRouteMiddleware } from '#app'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.meta?.validate) { return }

  const result = await Promise.resolve(to.meta.validate(to))
  if (typeof result === 'boolean') {
    return result
  }

  return createError(result)
})
