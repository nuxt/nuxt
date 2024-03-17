export default defineNuxtRouteMiddleware((to) => {
  to.meta.hello = 'Hello from routeRules!'
})
