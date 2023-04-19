import { parseURL } from 'ufo'
import { defineNuxtPlugin } from '#app/nuxt'
import { isPrerendered, loadPayload } from '#app/composables/payload'
import { useRouter } from '#app/composables/router'

export default defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // Only enable behavior if initial page is prerendered
    // TODO: Support hybrid and dev
    if (!isPrerendered()) {
      return
    }

    // Load payload into cache
    nuxtApp.hooks.hook('link:prefetch', async (url) => {
      if (!parseURL(url).protocol) {
        await loadPayload(url)
      }
    })

    // Load payload after middleware & once final route is resolved
    useRouter().beforeResolve(async (to, from) => {
      if (to.path === from.path) { return }
      const payload = await loadPayload(to.path)
      if (!payload) { return }
      Object.assign(nuxtApp.static.data, payload.data)
    })
  }
})
