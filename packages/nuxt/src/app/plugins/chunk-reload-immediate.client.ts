import type { RouteLocationNormalized } from 'vue-router'
import { joinURL } from 'ufo'
import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import { reloadNuxtApp } from '../composables/chunk'
import { addRouteMiddleware } from '../composables/router'

// See https://github.com/nuxt/nuxt/issues/23612 for more context
export default defineNuxtPlugin({
  name: 'nuxt:chunk-reload-immediate',
  setup (nuxtApp) {
    // Remember `to.path` when navigating to a new path: A `chunkError` may occur during navigation, we then want to then reload at `to.path`
    let currentlyNavigationTo: RouteLocationNormalized | null = null

    addRouteMiddleware((to) => {
      currentlyNavigationTo = to
    })

    const config = useRuntimeConfig()

    function reloadAppAtPath (to: RouteLocationNormalized) {
      const path = joinURL(config.app.baseURL, to.fullPath)

      reloadNuxtApp({ path, persistState: true })
    }

    // Reload when a `chunkError` is thrown
    nuxtApp.hook('app:chunkError', () => reloadAppAtPath(currentlyNavigationTo ?? nuxtApp._route))

    // Reload when the app manifest updates
    nuxtApp.hook('app:manifest:update', () => reloadAppAtPath(nuxtApp._route))
  },
})
