export default defineNuxtRouteMiddleware(() => {
  useNuxtApp().extendsMiddleware = true
})
