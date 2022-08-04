export default defineNuxtRouteMiddleware(async () => {
  await new Promise(resolve => setTimeout(resolve, 1))
  useNuxtApp()
})
