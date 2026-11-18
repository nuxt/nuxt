export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/forbidden') {
    throw createError({ status: 403, message: 'forbidden', fatal: true })
  }
})
