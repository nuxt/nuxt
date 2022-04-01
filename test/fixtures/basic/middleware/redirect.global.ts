export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/redirect/')) {
    await new Promise(resolve => setTimeout(resolve, 100))
    return navigateTo(to.path.slice('/redirect/'.length - 1))
  }
})
