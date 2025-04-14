import { defineNuxtPlugin } from '../nuxt'
import { loadPayload } from '../composables/payload'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { getAppManifest } from '../composables/manifest'

// @ts-expect-error virtual file
import { appManifest as isAppManifestEnabled, purgeCachedData } from '#build/nuxt.config.mjs'

export default defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // TODO: Support dev
    if (import.meta.dev) { return }

    // Load payload after middleware & once final route is resolved
    const staticKeysToRemove = new Set<string>()
    useRouter().beforeResolve(async (to, from) => {
      if (to.path === from.path) { return }
      const payload = await loadPayload(to.path)
      if (!payload) { return }
      if (purgeCachedData) {
        for (const key of staticKeysToRemove) {
          delete nuxtApp.static.data[key]
        }
      }
      for (const key in payload.data) {
        if (purgeCachedData) {
          if (!(key in nuxtApp.static.data)) {
            staticKeysToRemove.add(key)
          }
        }
        nuxtApp.static.data[key] = payload.data[key]
      }
    })

    onNuxtReady(() => {
      // Load payload into cache
      nuxtApp.hooks.hook('link:prefetch', async (url) => {
        const { hostname } = new URL(url, window.location.href)
        if (hostname === window.location.hostname) {
          // TODO: use preloadPayload instead once we can support preloading islands too
          await loadPayload(url).catch(() => { console.warn('[nuxt] Error preloading payload for', url) })
        }
      })
      if (isAppManifestEnabled && navigator.connection?.effectiveType !== 'slow-2g') {
        setTimeout(getAppManifest, 1000)
      }
    })
  },
})
