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

    interface LoadedStyles { map: RouteStylesMap, managed: Set<string> }

    // resolves to undefined (and the plugin no-ops) if the map cannot be loaded
    let styles: Promise<LoadedStyles | undefined> | undefined
    const loadStyles = () => styles ||= fetch(buildAssetsURL('route-styles.json') + '?' + config.app.buildId)
      .then(async (res) => {
        if (!res.ok) { return }
        const map = await res.json() as RouteStylesMap
        return { map, managed: new Set([...Object.values(map.layouts), ...Object.values(map.pages)].flat()) }
      })
      .catch(() => undefined)

    function toggleStyles ({ map, managed }: LoadedStyles, route: RouteLocationNormalized, { disable }: { disable: boolean }) {
      const layout = resolveLayoutName(route)
      const active = new Set([
        ...(layout && map.layouts[layout]) || [],
        ...route.matched.flatMap(record => (typeof record.name === 'string' && map.pages[record.name]) || []),
      ])
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
      const loaded = await loadStyles()
      if (loaded) {
        toggleStyles(loaded, to, { disable: false })
      }
    })

    nuxtApp.hook('page:finish', async () => {
      const loaded = !nuxtApp.isHydrating && await styles
      if (loaded) {
        toggleStyles(loaded, router.currentRoute.value, { disable: true })
      }
    })
  },
})

export default plugin
