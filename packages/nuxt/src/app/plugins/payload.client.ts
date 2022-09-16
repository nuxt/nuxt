import { defineNuxtPlugin, loadPayload, isPrerendered, useRouter } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Only enable behavior if initial page is prerendered
  // TOOD: Support hybrid and dev
  if (!isPrerendered()) {
    return
  }

  // Load payload into cache
  nuxtApp.hooks.hook('link:prefetch', to => loadPayload(to))

  // Load payload after middleware & once final route is resolved
  useRouter().beforeResolve(async (to, from) => {
    if (to.path === from.path) { return }
    const payload = await loadPayload(to.path)
    if (!payload) { return }
    Object.assign(nuxtApp.payload.data, payload.data)
    Object.assign(nuxtApp.payload.state, payload.state)
  })
})
