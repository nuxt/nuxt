import { showError, defineNuxtRouteMiddleware } from '#app'
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta?.validate) {
    const result = await Promise.resolve(to.meta.validate(to))
    if (result === false) {
      return showError({ statusCode: 404, message: 'This page could not be found' })
    }
  }
})
