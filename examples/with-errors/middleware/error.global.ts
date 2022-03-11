export default defineNuxtRouteMiddleware((to) => {
  if ('middleware' in to.query) {
    return throwError('error in middleware')
  }
})
