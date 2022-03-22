export default defineNuxtRouteMiddleware((to) => {
  to.meta.override = 'Injected by extended middleware from foo'
})
