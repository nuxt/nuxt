export default defineNuxtRouteMiddleware(() => {
  useState('tracked', () => false).value = true
})
