import { parseURL } from 'ufo'
import { defineNuxtPlugin, loadPayload, isPrerendered, useRouter } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Only enable behavior if initial page is prerendered
  // TOOD: Support hybrid and dev
  if (!isPrerendered()) {
    return
  }

  // Load payload into cache
  nuxtApp.hooks.hook('link:prefetch', (url) => {
    if (!parseURL(url).protocol) {
      return loadPayload(url)
    }
  })

  // Load payload after middleware & once final route is resolved
  useRouter().beforeResolve(async (to, from) => {
    if (to.path === from.path) { return }
    const payload = await loadPayload(to.path)
    if (!payload) { return }
    Object.assign(nuxtApp.static.data, payload.data)
  })
})
