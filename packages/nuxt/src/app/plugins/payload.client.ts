import { parseURL } from 'ufo'
import { defineNuxtPlugin } from '#app/nuxt'
import { loadPayload } from '#app/composables/payload'
import { onNuxtReady } from '#app/composables/ready'
import { useRouter } from '#app/composables/router'
import { getAppManifest } from '#app/composables/manifest'

export default defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // TODO: Support dev
    if (process.dev) { return }

    // Load payload after middleware & once final route is resolved
    useRouter().beforeResolve(async (to, from) => {
      if (to.path === from.path) { return }
      const payload = await loadPayload(to.path)
      if (!payload) { return }
      Object.assign(nuxtApp.static.data, payload.data)
    })

    onNuxtReady(() => {
      // Load payload into cache
      nuxtApp.hooks.hook('link:prefetch', async (url) => {
        if (!parseURL(url).protocol) {
          await loadPayload(url)
        }
      })
      setTimeout(getAppManifest, 1000)
    })
  }
})
