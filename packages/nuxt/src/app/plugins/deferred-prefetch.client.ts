import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { canPrefetch } from '../internal/prefetch-util'

import { buildAssetsURL } from '#internal/nuxt/paths'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:deferred-prefetch',
  setup () {
    onNuxtReady(() => {
      if (!canPrefetch()) { return }
      const assetsURL = buildAssetsURL()
      const requested = new Set(performance.getEntriesByType('resource').map(entry => entry.name))
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[href]')) {
        requested.add(link.href)
      }
      for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][data-href]')) {
        const value = link.dataset.href!
        if (!value.startsWith(assetsURL)) { continue }
        const href = new URL(value, document.baseURI).href
        if (!requested.has(href)) {
          link.href = href
        }
      }
    }, { timeout: 2000 })
  },
})

export default plugin
