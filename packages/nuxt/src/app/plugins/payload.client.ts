import { defineNuxtPlugin } from '../nuxt'
import { loadPayload } from '../composables/payload'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { getAppManifest } from '../composables/manifest'
// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // TODO: Support dev
    if (import.meta.dev) { return }

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
        const { hostname } = new URL(url, window.location.href)
        if (hostname === window.location.hostname) {
          await loadPayload(url)
        }
      })
      if (isAppManifestEnabled && navigator.connection?.effectiveType !== 'slow-2g') {
        setTimeout(getAppManifest, 1000)
      }
    })
  },
})
