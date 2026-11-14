import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { requestIdleCallback } from '../compat/idle-callback'
import { canPrefetch } from '../internal/prefetch-util'

import { buildAssetsURL } from '#internal/nuxt/paths'

const MIN_SLICE_MS = 4
const TIMEOUT_MS = 2000

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:deferred-prefetch',
  setup () {
    onNuxtReady(() => {
      if (!canPrefetch()) { return }
      const assetsURL = new URL(buildAssetsURL('/'), document.baseURI).href
      const links = document.head.querySelectorAll<HTMLLinkElement>('link[rel=prefetch][data-href]')
      let index = 0

      const activate = (deadline?: IdleDeadline) => {
        const end = performance.now() + Math.max(deadline?.timeRemaining() ?? 0, MIN_SLICE_MS)
        do {
          const link = links[index++]!
          let href: string
          try {
            href = new URL(link.dataset.href!, document.baseURI).href
          } catch {
            continue
          }
          if (href.startsWith(assetsURL)) {
            link.href = href
          }
        } while (index < links.length && performance.now() < end)

        if (index < links.length) {
          requestIdleCallback(activate, { timeout: TIMEOUT_MS })
        }
      }

      if (links.length) { activate() }
    }, { timeout: TIMEOUT_MS })
  },
})

export default plugin
