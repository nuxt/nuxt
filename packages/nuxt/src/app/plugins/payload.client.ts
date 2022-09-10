import { defineNuxtPlugin, loadPayload, addRouteMiddleware, isPrerendered } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Only enable behavior if initial page is prerendered
  // TOOD: Support hybrid
  if (!isPrerendered()) {
    return
  }
  addRouteMiddleware(async (to, from) => {
    if (to.path === from.path) { return }
    const url = to.path
    const payload = await loadPayload(url)
    if (!payload) {
      return
    }
    Object.assign(nuxtApp.payload.data, payload.data)
    Object.assign(nuxtApp.payload.state, payload.state)
  })
})
