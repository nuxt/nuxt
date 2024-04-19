import { nextTick } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useError } from '../composables/error'

// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  setup (nuxtApp) {
    const error = useError()

    function checkIfLayoutUsed () {
      if (!error.value && !nuxtApp._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        console.warn('[nuxt] Your project has layouts but the `<NuxtLayout />` component has not been used.')
      }
    }
    if (import.meta.server) {
      nuxtApp.hook('app:rendered', ({ renderResult }) => { renderResult?.html && nextTick(checkIfLayoutUsed) })
    } else {
      onNuxtReady(checkIfLayoutUsed)
    }
  },
  env: {
    islands: false,
  },
})
