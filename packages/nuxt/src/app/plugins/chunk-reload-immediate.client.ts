import { defineNuxtPlugin } from '../nuxt'
import { reloadNuxtApp } from '../composables/chunk'
import { addRouteMiddleware } from '../composables/router'

const reloadNuxtApp_ = (path: string) => { reloadNuxtApp({ persistState: true, path }) }

// See https://github.com/nuxt/nuxt/issues/23612 for more context
export default defineNuxtPlugin({
  name: 'nuxt:chunk-reload-immediate',
  setup (nuxtApp) {
    // Remember `to.path` when navigating to a new path: A `chunkError` may occur during navigation, we then want to then reload at `to.path`
    let currentlyNavigationTo: null | string = null
    addRouteMiddleware((to) => {
      currentlyNavigationTo = to.path
    })

    // Reload when a `chunkError` is thrown
    nuxtApp.hook('app:chunkError', () => reloadNuxtApp_(currentlyNavigationTo ?? nuxtApp._route.path))

    // Reload when the app manifest updates
    nuxtApp.hook('app:manifest:update', () => reloadNuxtApp_(nuxtApp._route.path))
  },
})
