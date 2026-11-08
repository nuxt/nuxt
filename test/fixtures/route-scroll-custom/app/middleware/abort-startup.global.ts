export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client && useNuxtApp().isHydrating && 'abortStartup' in to.query) {
    return false
  }
})
