import { defineNuxtPlugin } from '../nuxt'
import { onNuxtReady } from '../composables/ready'

// @ts-expect-error virtual file
import layouts from '#build/layouts'

export default defineNuxtPlugin({
  name: 'nuxt:checkIfLayoutUsed',
  enforce: 'post',
  setup (nuxtApp) {
    onNuxtReady(() => {
      if (!nuxtApp.payload._isNuxtLayoutUsed && Object.keys(layouts).length > 0) {
        // TODO: Use logger
        console.warn('[nuxt] Your project has layouts but the `<NuxtLayout />` component has not been used.')
      }
    })
  }
})
