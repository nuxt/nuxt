export default defineNuxtRouteMiddleware(() => {
  return navigateTo('/login', { redirectCode: 302 })
})
