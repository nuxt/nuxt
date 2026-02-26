export default defineNuxtRouteMiddleware((to) => {
  if ('abort' in to.query) {
    return abortNavigation({
      status: 401,
    })
  }
})
