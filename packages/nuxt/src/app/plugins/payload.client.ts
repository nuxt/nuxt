import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { loadPayload } from '../composables/payload'
import { onNuxtReady } from '../composables/ready'
import { useRouter } from '../composables/router'
import { getAppManifest } from '../composables/manifest'
import { injectHead } from '../composables/head'

import { appManifest as isAppManifestEnabled, prefetchPreloadTags, purgeCachedData } from '#build/nuxt.config.mjs'

// track the active head entry per URL for forwarded preload hints
interface ActiveHeadEntryLike { dispose: () => void }
const forwardedPrefetchEntries = new Map<string, ActiveHeadEntryLike>()

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:payload',
  setup (nuxtApp) {
    // Load payload after middleware & once final route is resolved
    const staticKeysToRemove = new Set<string>()
    useRouter().beforeResolve(async (to, from) => {
      if (to.path === from.path) { return }
      if (prefetchPreloadTags) {
        // drop forwarded `rel="prefetch" hints so they don't linger indefinitely.
        const entry = forwardedPrefetchEntries.get(to.path)
        if (entry) {
          entry.dispose()
          forwardedPrefetchEntries.delete(to.path)
        }
      }
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
      const head = prefetchPreloadTags ? injectHead(nuxtApp) : null
      nuxtApp.hooks.hook('link:prefetch', async (url) => {
        const { hostname } = new URL(url, window.location.href)
        if (hostname !== window.location.hostname) { return }
        // TODO: use preloadPayload instead once we can support preloading islands too
        const payload = await loadPayload(url).catch(() => { console.warn('[nuxt] Error preloading payload for', url) })
        if (head && payload?.prefetchLinks?.length && !forwardedPrefetchEntries.has(url)) {
          const entry = head.push({
            link: payload.prefetchLinks.map((link: Record<string, string | boolean>) => {
              // downgrade preload (and modulepreload) to prefetch
              const { rel: _rel, ...rest } = link
              return { ...rest, rel: 'prefetch' }
            }),
          })
          forwardedPrefetchEntries.set(url, entry)
        }
      })
      // `navigator.connection` (Network Information API) is widely supported in
      // browsers but not part of the standard TS DOM lib.
      if (isAppManifestEnabled && (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType !== 'slow-2g') {
        setTimeout(getAppManifest, 1000)
      }
    })
  },
})

export default plugin
