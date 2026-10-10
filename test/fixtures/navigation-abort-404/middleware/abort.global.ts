export default defineNuxtRouteMiddleware((to) => {
  if (to.query.abort === '1') { return false }
})
