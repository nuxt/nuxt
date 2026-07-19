import { nextTick } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useError } from '../composables/error'
import { renderDiagnostics } from '../diagnostics/render'

import layouts from '#build/layouts'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  setup (nuxtApp) {
    const error = useError()

    function checkIfLayoutUsed () {
      if (!error.value && !nuxtApp._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        renderDiagnostics.NUXT_E4007()
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

export default plugin
