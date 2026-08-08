export default defineNuxtRouteMiddleware(() => {
  const session = useCookie('session')
  if (!session.value) {
    return navigateTo('/login')
  }
})
