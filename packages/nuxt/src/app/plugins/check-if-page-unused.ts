import { nextTick } from 'vue'
import { defineNuxtPlugin, useRuntimeConfig } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useError } from '../composables/error'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfPageUnused',
  setup (nuxtApp) {
    const error = useError()
    const config = useRuntimeConfig()

    function checkIfPageUnused () {
      if (!error.value && config.public._pages && !nuxtApp._isNuxtPageUsed) {
        console.warn(
          '[nuxt] Your project has pages but the `<NuxtPage />` component has not been used.'
          + ' You might be using the `<RouterView />` component instead,'
          + ' or you could set `pages: false` in `nuxt.config`.'
        )
      }
    }

    if (import.meta.server) {
      nuxtApp.hook('app:rendered', () => { nextTick(checkIfPageUnused) })
    } else {
      onNuxtReady(checkIfPageUnused)
    }
  },
  env: {
    islands: false
  }
})
