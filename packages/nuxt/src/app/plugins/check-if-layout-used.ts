import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  setup (nuxtApp) {
    function checkIfLayoutUsed () {
      if (!nuxtApp._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        console.warn('[nuxt] Your project has layouts but the `<NuxtLayout />` component has not been used.')
      }
    }
    if (import.meta.server) {
      nuxtApp.hook('app:rendered', checkIfLayoutUsed)
    } else {
      onNuxtReady(checkIfLayoutUsed)
    }
  },
  env: {
    islands: false
  }
})
