import type { RouteLocationNormalized } from 'vue-router'
import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { useRouter } from '../composables/router'
import { resolveLayoutName } from '../composables/layout'
import { buildAssetsURL } from '#internal/nuxt/paths'

interface RouteStylesMap {
  layouts: Record<string, string[]>
  pages: Record<string, string[]>
}

/**
 * Disables stylesheets belonging to pages/layouts that are no longer rendered
 * after a client-side navigation, using the `route-styles.json` map emitted by
 * the `nuxt:route-styles-map` vite plugin. Links are toggled via `disabled`
 * (never removed) so vite's preload helper does not need to re-inject them.
 */
const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:cleanup-route-styles',
  setup (nuxtApp) {
    const router = useRouter()
    const config = useRuntimeConfig()

    let map: RouteStylesMap | false | undefined
    let managed: Set<string>
    let loading: Promise<void> | undefined
    const loadMap = () => loading ||= (async () => {
      let loaded: RouteStylesMap | false = false
      try {
        const res = await fetch(buildAssetsURL('route-styles.json') + '?' + config.app.buildId)
        if (res.ok) {
          loaded = await res.json() as RouteStylesMap
        }
      } catch {
        // if the map cannot be loaded the plugin is a no-op
      }
      map = loaded
      managed = new Set(loaded ? [...Object.values(loaded.layouts), ...Object.values(loaded.pages)].flat() : [])
    })()

    function activeStyles (route: RouteLocationNormalized) {
      const active = new Set<string>()
      if (!map) { return active }
      const layout = resolveLayoutName(route)
      for (const file of (layout && map.layouts[layout]) || []) {
        active.add(file)
      }
      for (const record of route.matched) {
        if (typeof record.name === 'string') {
          for (const file of map.pages[record.name] || []) {
            active.add(file)
          }
        }
      }
      return active
    }

    function toggleStyles (route: RouteLocationNormalized, { disable }: { disable: boolean }) {
      const active = activeStyles(route)
      for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
        const file = link.href.split('/').pop()?.replace(/\?.*$/, '')
        if (!file || !managed.has(file)) { continue }
        if (active.has(file)) {
          link.disabled = false
        } else if (disable) {
          link.disabled = true
        }
      }
    }

    // Re-enable the incoming route's styles before the DOM updates to avoid a
    // flash of unstyled content when returning to a previously visited route.
    router.beforeResolve(async (to) => {
      if (nuxtApp.isHydrating) { return }
      await loadMap()
      if (map) {
        toggleStyles(to, { disable: false })
      }
    })

    nuxtApp.hook('page:finish', () => {
      if (nuxtApp.isHydrating || !map) { return }
      toggleStyles(router.currentRoute.value, { disable: true })
    })
  },
})

export default plugin
