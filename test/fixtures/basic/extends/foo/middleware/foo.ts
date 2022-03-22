export default defineNuxtRouteMiddleware((to) => {
  to.meta.foo = 'Injected by extended middleware'
})
