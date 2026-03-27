import { nextTick } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useError } from '../composables/error'
import { runtimeWarn } from '../utils'
import { E4007 } from '../error-codes'

// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  setup (nuxtApp) {
    const error = useError()

    function checkIfLayoutUsed () {
      if (!error.value && !nuxtApp._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        runtimeWarn('Your project has layouts but the `<NuxtLayout />` component has not been used.', {
          code: E4007,
        })
      }
    }
    if (import.meta.server) {
      nuxtApp.hook('app:rendered', ({ renderResult }) => {
        if (renderResult?.html) {
          nextTick(checkIfLayoutUsed)
        }
      })
    } else {
      onNuxtReady(checkIfLayoutUsed)
    }
  },
  env: {
    islands: false,
  },
})
