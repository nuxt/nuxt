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
      const assetsURL = new URL(buildAssetsURL('/'), document.baseURI).href
      for (const link of document.head.querySelectorAll<HTMLLinkElement>('link[rel=prefetch][data-href]')) {
        let href: string
        try {
          href = new URL(link.dataset.href!, document.baseURI).href
        } catch {
          continue
        }
        if (href.startsWith(assetsURL)) {
          link.href = href
        }
      }
    }, { timeout: 2000 })
  },
})

export default plugin
