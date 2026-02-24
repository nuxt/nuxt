export default defineNuxtRouteMiddleware(async () => {
  await new Promise(resolve => setTimeout(resolve, 10))
  setPageLayout('custom', {
    foo: 'set from sets-layouts middleware',
  })
})
