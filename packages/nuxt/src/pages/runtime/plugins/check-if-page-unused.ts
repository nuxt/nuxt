import { nextTick } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'
import { onNuxtReady } from '#app/composables/ready'
import { useError } from '#app/composables/error'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfPageUnused',
  setup (nuxtApp) {
    const error = useError()

    function checkIfPageUnused () {
      if (!error.value && !nuxtApp._isNuxtPageUsed) {
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
