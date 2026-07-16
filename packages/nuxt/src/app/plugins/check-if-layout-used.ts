import { nextTick } from 'vue'
import { defineNuxtPlugin } from '../nuxt'
import type { ObjectPlugin, Plugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'
import { useError } from '../composables/error'

import layouts from '#build/layouts'

const plugin: Plugin & ObjectPlugin = defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  setup (nuxtApp) {
    const error = useError()

    function checkIfLayoutUsed () {
      if (!error.value && !nuxtApp._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        console.warn(
          '[nuxt] Your project has layouts but `<NuxtLayout />` has not been detected.' +
          ' Make sure you are using `<NuxtLayout />` in your app to render layouts.' +
          ' If `<NuxtLayout />` is rendered conditionally, this warning can be triggered before it is mounted.',
        )
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
