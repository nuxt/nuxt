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
          '[nuxt] Your project has pages but `<NuxtPage />` has not been detected.' +
          ' Make sure you are using `<NuxtPage />` instead of `<RouterView />`, as `<RouterView />` will not work correctly in Nuxt.' +
          ' If `<NuxtPage />` is rendered conditionally, this warning can be triggered before it is mounted.' +
          ' You can set `pages: false` in `nuxt.config` if you do not wish to use the Nuxt `vue-router` integration.',
        )
      }
    }

    if (import.meta.server) {
      nuxtApp.hook('app:rendered', ({ renderResult }) => {
        if (renderResult?.html) {
          nextTick(checkIfPageUnused)
        }
      })
    } else {
      onNuxtReady(checkIfPageUnused)
    }
  },
  env: {
    islands: false,
  },
})
