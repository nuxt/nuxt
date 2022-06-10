export default defineNuxtRouteMiddleware((to) => {
  to.meta.override = 'This middleware should be overriden by bar'
})
