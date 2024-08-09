import { defineNuxtPlugin } from '../nuxt'
import { reloadNuxtApp } from '../composables/chunk'

const reloadNuxtApp_ = () => { reloadNuxtApp({ persistState: true }) }

// See https://github.com/nuxt/nuxt/issues/23612 for more context
export default defineNuxtPlugin({
  name: 'nuxt:chunk-reload-immediate',
  setup (nuxtApp) {
    // Reload when a `chunkError` is thrown
    nuxtApp.hook('app:chunkError', reloadNuxtApp_)

    // Reload when the app manifest updates
    nuxtApp.hook('app:manifest:update', reloadNuxtApp_)
  },
})
