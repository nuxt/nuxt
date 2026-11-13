export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:error', error => record(`app:error:${error.message}`))
  addRouteMiddleware((to) => {
    record(`middleware:${to.path}:${useError().value ? 'error' : 'clear'}`)
    if (to.path === '/forbidden') {
      throw createError({ status: 403, message: 'forbidden', fatal: true })
    }
  }, { global: true })
})
