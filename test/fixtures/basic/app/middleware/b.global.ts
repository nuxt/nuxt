export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/middleware/ordering' && !useNuxtApp().extendsMiddleware) {
    return createError('extendsMiddleware not set in layer')
  }
})
