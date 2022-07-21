export default defineNuxtRouteMiddleware((to) => {
  if ('middleware' in to.query) {
    return showError('error in middleware')
  }
})
