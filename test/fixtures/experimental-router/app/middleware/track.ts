export default defineNuxtRouteMiddleware((to) => {
  to.meta.tracked = 'tracked-by-middleware'
})
