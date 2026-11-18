export default defineNuxtRouteMiddleware(() => {
  useState('probe-middleware', () => 0).value++
})
