export default defineNuxtRouteMiddleware((to) => {
  useNuxtApp().extendsMiddleware = true
})
