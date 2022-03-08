export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/redirect/')) {
    return navigateTo(to.path.slice('/redirect/'.length - 1))
  }
})
