export default defineNuxtRouteMiddleware(() => {
  useCookie('island-auth-marker').value = 'set-from-island-middleware'
  return navigateTo('/login', { redirectCode: 302 })
})
