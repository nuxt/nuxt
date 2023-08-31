export default defineNuxtRouteMiddleware((to) => {
  to.meta.globalMiddleware = to.meta.globalMiddleware || []
  to.meta.globalMiddleware.push('01.b.global')
})
