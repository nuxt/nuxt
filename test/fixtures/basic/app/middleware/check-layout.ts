export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    useState('middleware-layout', () => String(to.meta.layout))
  }
})
