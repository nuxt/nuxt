export default defineNuxtRouteMiddleware((to) => {
  to.meta.globalMiddleware = to.meta.globalMiddleware || []
  to.meta.globalMiddleware.push('b.global')
})
