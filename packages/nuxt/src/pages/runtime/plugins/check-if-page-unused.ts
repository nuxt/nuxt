import { nextTick } from 'vue'
import { defineNuxtPlugin } from '#app/nuxt'
import type { ObjectPlugin, Plugin } from '#app/nuxt'
import { onNuxtReady } from '#app/composables/ready'
import { useError } from '#app/composables/error'
import { renderDiagnostics } from '../../../app/diagnostics/render.ts'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:checkIfPageUnused',
  setup (nuxtApp) {
    const error = useError()

    function checkIfPageUnused () {
      if (!error.value && !nuxtApp._isNuxtPageUsed) {
        renderDiagnostics.NUXT_E4011()
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

export default plugin
