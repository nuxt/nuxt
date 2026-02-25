export default defineNuxtRouteMiddleware((to) => {
  to.meta.auth = 'Injected by injectAuth middleware'
})
