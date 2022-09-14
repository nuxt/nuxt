import { defineNuxtPlugin, loadPayload, addRouteMiddleware, isPrerendered } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Only enable behavior if initial page is prerendered
  // TOOD: Support hybrid and dev
  if (!isPrerendered()) {
    return
  }
  const prefetchPayload = async (url: string) => {
    const payload = await loadPayload(url)
    if (!payload) { return }
    Object.assign(nuxtApp.payload.data, payload.data)
    Object.assign(nuxtApp.payload.state, payload.state)
  }
  nuxtApp.hooks.hook('link:prefetch', async (to) => {
    await prefetchPayload(to)
  })
  addRouteMiddleware(async (to, from) => {
    if (to.path === from.path) { return }
    await prefetchPayload(to.path)
  })
})
