export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:error', error => record(`app:error:${error.message}`))
  addRouteMiddleware((to) => {
    record(`middleware:${to.path}`)
    if (to.path === '/forbidden') {
      throw createError({ status: 403, message: 'forbidden', fatal: true })
    }
    if (to.query.pending !== undefined) {
      return new Promise<void>((resolve) => { (window as any).__release = resolve })
    }
  }, { global: true })
})
